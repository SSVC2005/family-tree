// Utility functions for working with family tree data structures

// Remove circular references from tree data before sending to client
export function sanitizeTreeForClient(tree) {
  if (!tree) return null

  const sanitized = JSON.parse(JSON.stringify(tree))

  // Recursively clean the tree structure
  function cleanPerson(person, depth = 0) {
    if (!person || depth > 10) return person // Prevent infinite recursion

    // Clean spouse reference (keep only basic info, remove spouse.spouse)
    if (person.spouse) {
      person.spouse = {
        id: person.spouse.id,
        firstName: person.spouse.firstName,
        lastName: person.spouse.lastName,
        dob: person.spouse.dob,
        gender: person.spouse.gender,
        occupation: person.spouse.occupation,
        placeOfBirth: person.spouse.placeOfBirth,
        currentAddress: person.spouse.currentAddress,
        photo: person.spouse.photo,
        isDeceased: person.spouse.isDeceased,
        dateOfDeath: person.spouse.dateOfDeath,
        children: person.spouse.children || [],
        parents: person.spouse.parents || [],
        // Don't include spouse.spouse to avoid circular reference
      }
    }

    // Clean children recursively
    if (person.children) {
      person.children = person.children.map((child) => cleanPerson(child, depth + 1))
    }

    // Clean parents (keep minimal info to avoid duplication)
    if (person.parents) {
      person.parents = person.parents.map((parent) => ({
        id: parent.id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        dob: parent.dob,
        gender: parent.gender,
        occupation: parent.occupation,
        placeOfBirth: parent.placeOfBirth,
        currentAddress: parent.currentAddress,
        photo: parent.photo,
        isDeceased: parent.isDeceased,
        dateOfDeath: parent.dateOfDeath,
        // Don't include nested relationships for parents to avoid duplication
        children: [],
        spouse: parent.spouse
          ? {
              id: parent.spouse.id,
              firstName: parent.spouse.firstName,
              lastName: parent.spouse.lastName,
              gender: parent.spouse.gender,
              photo: parent.spouse.photo,
              isDeceased: parent.spouse.isDeceased,
              dateOfDeath: parent.spouse.dateOfDeath,
            }
          : null,
        parents: [],
      }))
    }

    return person
  }

  if (sanitized.rootPerson) {
    sanitized.rootPerson = cleanPerson(sanitized.rootPerson)
  }

  if (Array.isArray(sanitized.ancestors)) {
    sanitized.ancestors = sanitized.ancestors.map((p) => cleanPerson(p))
  }

  return sanitized
}

// Build relationships after loading from database
export function buildTreeRelationships(tree) {
  if (!tree || !tree.rootPerson) return tree

  const personMap = new Map()

  // First pass: collect all people
  function collectPeople(person, depth = 0) {
    if (!person || !person.id || depth > 10) return // Prevent infinite recursion

    personMap.set(person.id, person)

    if (person.children) {
      person.children.forEach((child) => collectPeople(child, depth + 1))
    }

    if (person.spouse) {
      collectPeople(person.spouse, depth + 1)
    }

    if (person.parents) {
      person.parents.forEach((parent) => collectPeople(parent, depth + 1))
    }
  }

  collectPeople(tree.rootPerson)

  // Also collect standalone ancestors (parents added to children but not linked upward)
  if (Array.isArray(tree.ancestors)) {
    tree.ancestors.forEach((p) => collectPeople(p))
  }

  // Second pass: rebuild relationships using IDs (but keep it minimal)
  function rebuildRelationships(person, depth = 0) {
    if (!person || depth > 10) return person // Prevent infinite recursion

    // Rebuild spouse relationship
    if (person.spouseId && personMap.has(person.spouseId)) {
      const spouse = personMap.get(person.spouseId)
      person.spouse = {
        ...spouse,
        spouse: null, // Prevent circular reference
      }
    }

    // Keep parent relationships minimal to prevent duplication
    if (person.parentIds && person.parentIds.length > 0) {
      person.parents = person.parentIds
        .map((parentId) => personMap.get(parentId))
        .filter(Boolean)
        .map((parent) => ({
          ...parent,
          children: [], // Prevent circular reference
          spouse: parent.spouse
            ? {
                id: parent.spouse.id,
                firstName: parent.spouse.firstName,
                lastName: parent.spouse.lastName,
                gender: parent.spouse.gender,
                photo: parent.spouse.photo,
                isDeceased: parent.spouse.isDeceased,
                dateOfDeath: parent.spouse.dateOfDeath,
              }
            : null,
          parents: [], // Prevent circular reference
        }))
    }

    // Recursively rebuild for children
    if (person.children) {
      person.children = person.children.map((child) => rebuildRelationships(child, depth + 1))
    }

    return person
  }

  const rebuiltTree = { ...tree }
  rebuiltTree.rootPerson = rebuildRelationships(rebuiltTree.rootPerson)

  return rebuiltTree
}
