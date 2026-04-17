import { ObjectId } from "mongodb"
import clientPromise from "./mongodb"

export async function createUser(userData) {
  const client = await clientPromise
  const db = client.db("familytree")

  const result = await db.collection("users").insertOne({
    ...userData,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return result
}

export async function findUserByEmail(email) {
  const client = await clientPromise
  const db = client.db("familytree")

  return await db.collection("users").findOne({ email })
}

export async function createFamilyTree(treeData) {
  const client = await clientPromise
  const db = client.db("familytree")

  const result = await db.collection("familytrees").insertOne({
    ...treeData,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return result
}

export async function getFamilyTreesByUser(userId) {
  const client = await clientPromise
  const db = client.db("familytree")

  return await db
    .collection("familytrees")
    .find({
      userId: new ObjectId(userId),
    })
    .toArray()
}

export async function findUserById(userId) {
  const client = await clientPromise
  const db = client.db("familytree")

  return await db.collection("users").findOne({ _id: new ObjectId(userId) })
}

export async function findPersonInTrees(firstName, lastName, dob) {
  const client = await clientPromise
  const db = client.db("familytree")

  // Search for existing person in all family trees
  const trees = await db.collection("familytrees").find({}).toArray()
  const existingPersons = []

  for (const tree of trees) {
    const found = searchPersonInTree(tree, firstName, lastName, dob)
    if (found.length > 0) {
      existingPersons.push(
        ...found.map((person) => ({
          ...person,
          treeId: tree._id,
          treeName: tree.lastName,
        })),
      )
    }
  }

  return existingPersons
}

function searchPersonInTree(tree, firstName, lastName, dob) {
  const results = []

  function searchPerson(person) {
    if (!person) return

    // Check if person matches
    if (
      person.firstName?.toLowerCase() === firstName.toLowerCase() &&
      person.lastName?.toLowerCase() === lastName.toLowerCase() &&
      person.dob === dob
    ) {
      results.push(person)
    }

    // Search in children
    if (person.children) {
      person.children.forEach(searchPerson)
    }

    // Search in spouse
    if (person.spouse) {
      searchPerson(person.spouse)
    }

    // Search in parents
    if (person.parents) {
      person.parents.forEach(searchPerson)
    }
  }

  if (tree.rootPerson) {
    searchPerson(tree.rootPerson)
  }

  return results
}
