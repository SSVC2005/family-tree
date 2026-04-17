import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import {
  createTreeDocument,
  grantSurnameEditorAccess,
  normalizeLastName,
  normalizeTreeDocument,
  saveTree,
} from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

function validateRootPayload(payload) {
  if (!payload.firstName || !payload.lastName || !payload.dob || !payload.gender) {
    throw new Error("First name, last name, date of birth, and gender are required")
  }

  const dobDate = new Date(payload.dob)
  if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) {
    throw new Error("Invalid date of birth")
  }
}

export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { firstName, lastName, dob, placeOfBirth, occupation, currentAddress, gender, photo } = body

    try {
      validateRootPayload({ firstName, lastName, dob, gender })
    } catch (validationError) {
      return Response.json({ message: validationError.message }, { status: 400 })
    }

    const normalizedSurname = normalizeLastName(lastName)
    const existingTreeRaw = await db.collection("familytrees").findOne({
      $or: [
        { normalizedLastName: normalizedSurname },
        { lastName: { $regex: `^${lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      ],
    })

    if (existingTreeRaw) {
      const { tree: existingTree, changed } = normalizeTreeDocument(existingTreeRaw)
      if (changed) {
        await saveTree(db, existingTree)
      }

      const userSurname = normalizeLastName(user.lastName)
      if (userSurname !== normalizedSurname) {
        return Response.json(
          {
            message:
              "A tree with this surname already exists. You can collaborate only if your account surname matches.",
          },
          { status: 403 },
        )
      }

      const granted = grantSurnameEditorAccess(existingTree, user)
      if (granted) {
        await saveTree(db, existingTree)
      }

      return Response.json({
        message: "A family tree with this surname already exists. You were added as a collaborator.",
        treeId: String(existingTree._id),
        joinedExisting: true,
      })
    }

    const treeDocument = createTreeDocument({
      ownerUserId: user._id,
      lastName,
      rootMember: {
        firstName,
        lastName,
        dob,
        placeOfBirth,
        occupation,
        currentAddress,
        gender,
        photo,
        isDeceased: false,
      },
    })

    const result = await db.collection("familytrees").insertOne(treeDocument)

    return Response.json({
      message: "Family tree created successfully",
      treeId: String(result.insertedId),
      joinedExisting: false,
    })
  } catch (error) {
    console.error("Create family tree error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
