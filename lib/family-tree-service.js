import { ObjectId } from "mongodb"

const TREE_SCHEMA_VERSION = 2

const RELATIONSHIP_STATUS = {
  MARRIED: "married",
  DIVORCED: "divorced",
  WIDOWED: "widowed",
}

const PERSON_EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "dob",
  "placeOfBirth",
  "occupation",
  "currentAddress",
  "gender",
  "photo",
  "isDeceased",
  "dateOfDeath",
]

function cleanText(value) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function normalizeDate(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function toIsoNow() {
  return new Date().toISOString()
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  const result = []

  for (const value of values) {
    if (typeof value !== "string") continue
    const clean = value.trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    result.push(clean)
  }

  return result
}

function objectIdFromUnknown(value) {
  if (!value) return null
  if (value instanceof ObjectId) return value

  try {
    return new ObjectId(String(value))
  } catch {
    return null
  }
}

function objectIdToString(value) {
  if (!value) return ""
  return String(value)
}

function uniqueObjectIds(values) {
  if (!Array.isArray(values)) return []

  const seen = new Set()
  const result = []

  for (const value of values) {
    const objectId = objectIdFromUnknown(value)
    if (!objectId) continue

    const key = objectId.toHexString()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(objectId)
  }

  return result
}

function hasValue(text) {
  return typeof text === "string" && text.trim().length > 0
}

export function normalizeLastName(lastName) {
  return cleanText(lastName).toLowerCase()
}

export function generatePersonId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []

  const normalized = []
  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue

    const partnerId = cleanText(entry.partnerId)
    if (!partnerId) continue

    const status =
      entry.status === RELATIONSHIP_STATUS.MARRIED ||
      entry.status === RELATIONSHIP_STATUS.DIVORCED ||
      entry.status === RELATIONSHIP_STATUS.WIDOWED
        ? entry.status
        : RELATIONSHIP_STATUS.DIVORCED

    normalized.push({
      partnerId,
      status,
      startedAt: entry.startedAt || toIsoNow(),
      endedAt: entry.endedAt || null,
    })
  }

  return normalized
}

function createMemberFromAny(memberInput = {}, overrides = {}) {
  const now = toIsoNow()

  const member = {
    id: cleanText(overrides.id || memberInput.id) || generatePersonId(),
    firstName: cleanText(overrides.firstName ?? memberInput.firstName),
    lastName: cleanText(overrides.lastName ?? memberInput.lastName),
    dob: normalizeDate(overrides.dob ?? memberInput.dob),
    placeOfBirth: cleanText(overrides.placeOfBirth ?? memberInput.placeOfBirth),
    occupation: cleanText(overrides.occupation ?? memberInput.occupation),
    currentAddress: cleanText(overrides.currentAddress ?? memberInput.currentAddress),
    gender: cleanText(overrides.gender ?? memberInput.gender),
    photo: typeof (overrides.photo ?? memberInput.photo) === "string" ? overrides.photo ?? memberInput.photo : "",
    isDeceased: Boolean(overrides.isDeceased ?? memberInput.isDeceased),
    dateOfDeath: normalizeDate(overrides.dateOfDeath ?? memberInput.dateOfDeath),
    parentIds: uniqueStrings(overrides.parentIds ?? memberInput.parentIds),
    childIds: uniqueStrings(overrides.childIds ?? memberInput.childIds),
    activeSpouseId: cleanText(overrides.activeSpouseId ?? memberInput.activeSpouseId) || null,
    spouseHistory: normalizeHistory(overrides.spouseHistory ?? memberInput.spouseHistory),
    createdAt: memberInput.createdAt || now,
    updatedAt: now,
  }

  if (!member.isDeceased) {
    member.dateOfDeath = ""
  }

  return member
}

function addHistoryEntry(member, partnerId, status, endedAt = null) {
  if (!partnerId) return

  const existingActive = member.spouseHistory.find(
    (entry) => entry.partnerId === partnerId && !entry.endedAt && entry.status === RELATIONSHIP_STATUS.MARRIED,
  )

  if (existingActive) {
    existingActive.status = status
    existingActive.endedAt = endedAt || toIsoNow()
    member.updatedAt = toIsoNow()
    return
  }

  member.spouseHistory.push({
    partnerId,
    status,
    startedAt: toIsoNow(),
    endedAt: endedAt || (status === RELATIONSHIP_STATUS.MARRIED ? null : toIsoNow()),
  })
  member.updatedAt = toIsoNow()
}

function addMarriageHistory(member, partnerId) {
  if (!partnerId) return

  const hasActiveMarriage = member.spouseHistory.some(
    (entry) =>
      entry.partnerId === partnerId && entry.status === RELATIONSHIP_STATUS.MARRIED && (entry.endedAt === null || !entry.endedAt),
  )

  if (hasActiveMarriage) return

  member.spouseHistory.push({
    partnerId,
    status: RELATIONSHIP_STATUS.MARRIED,
    startedAt: toIsoNow(),
    endedAt: null,
  })
  member.updatedAt = toIsoNow()
}

function linkParentChild(memberMap, parentId, childId) {
  const parent = memberMap.get(parentId)
  const child = memberMap.get(childId)
  if (!parent || !child) return

  if (!parent.childIds.includes(childId)) {
    parent.childIds.push(childId)
    parent.updatedAt = toIsoNow()
  }

  if (!child.parentIds.includes(parentId)) {
    child.parentIds.push(parentId)
    child.updatedAt = toIsoNow()
  }
}

function unlinkParentChild(memberMap, parentId, childId) {
  const parent = memberMap.get(parentId)
  const child = memberMap.get(childId)
  if (!parent || !child) return

  parent.childIds = parent.childIds.filter((id) => id !== childId)
  child.parentIds = child.parentIds.filter((id) => id !== parentId)
  parent.updatedAt = toIsoNow()
  child.updatedAt = toIsoNow()
}

function marryMembers(memberMap, leftId, rightId) {
  const left = memberMap.get(leftId)
  const right = memberMap.get(rightId)

  if (!left || !right) {
    throw new Error("Cannot connect spouse relationship")
  }

  if (left.activeSpouseId && left.activeSpouseId !== right.id) {
    throw new Error("Person already has an active spouse. Mark divorced or spouse deceased first.")
  }

  if (right.activeSpouseId && right.activeSpouseId !== left.id) {
    throw new Error("Selected spouse already has an active spouse.")
  }

  left.activeSpouseId = right.id
  right.activeSpouseId = left.id
  addMarriageHistory(left, right.id)
  addMarriageHistory(right, left.id)
  left.updatedAt = toIsoNow()
  right.updatedAt = toIsoNow()
}

function dissolveMarriage(memberMap, leftId, rightId, status) {
  const left = memberMap.get(leftId)
  const right = memberMap.get(rightId)

  if (!left || !right) return

  if (left.activeSpouseId === right.id) {
    left.activeSpouseId = null
  }

  if (right.activeSpouseId === left.id) {
    right.activeSpouseId = null
  }

  addHistoryEntry(left, right.id, status)
  addHistoryEntry(right, left.id, status)
  left.updatedAt = toIsoNow()
  right.updatedAt = toIsoNow()
}

function closeMarriageIfPartnerDeceased(memberMap, member) {
  if (!member.activeSpouseId) return

  const spouse = memberMap.get(member.activeSpouseId)
  if (!spouse) {
    member.activeSpouseId = null
    member.updatedAt = toIsoNow()
    return
  }

  if (!spouse.isDeceased) return

  dissolveMarriage(memberMap, member.id, spouse.id, RELATIONSHIP_STATUS.WIDOWED)
}

function normalizeMemberMap(memberMap) {
  for (const [memberId, member] of memberMap) {
    member.id = cleanText(member.id || memberId)
    member.firstName = cleanText(member.firstName)
    member.lastName = cleanText(member.lastName)
    member.dob = normalizeDate(member.dob)
    member.placeOfBirth = cleanText(member.placeOfBirth)
    member.occupation = cleanText(member.occupation)
    member.currentAddress = cleanText(member.currentAddress)
    member.gender = cleanText(member.gender)
    member.photo = typeof member.photo === "string" ? member.photo : ""
    member.isDeceased = Boolean(member.isDeceased)
    member.dateOfDeath = member.isDeceased ? normalizeDate(member.dateOfDeath) : ""
    member.parentIds = uniqueStrings(member.parentIds).filter((id) => id !== member.id && memberMap.has(id))
    member.childIds = uniqueStrings(member.childIds).filter((id) => id !== member.id && memberMap.has(id))
    member.spouseHistory = normalizeHistory(member.spouseHistory)

    if (member.activeSpouseId) {
      member.activeSpouseId = cleanText(member.activeSpouseId)
      if (!memberMap.has(member.activeSpouseId) || member.activeSpouseId === member.id) {
        member.activeSpouseId = null
      }
    } else {
      member.activeSpouseId = null
    }

    if (!member.createdAt) member.createdAt = toIsoNow()
    if (!member.updatedAt) member.updatedAt = toIsoNow()
  }

  // Ensure parent-child links are bidirectional.
  for (const member of memberMap.values()) {
    for (const parentId of member.parentIds) {
      const parent = memberMap.get(parentId)
      if (!parent) continue
      if (!parent.childIds.includes(member.id)) {
        parent.childIds.push(member.id)
      }
    }

    for (const childId of member.childIds) {
      const child = memberMap.get(childId)
      if (!child) continue
      if (!child.parentIds.includes(member.id)) {
        child.parentIds.push(member.id)
      }
    }
  }

  // Ensure spouse links are bidirectional and deceased relationships are closed.
  for (const member of memberMap.values()) {
    if (!member.activeSpouseId) continue

    const spouse = memberMap.get(member.activeSpouseId)
    if (!spouse) {
      member.activeSpouseId = null
      continue
    }

    if (!spouse.activeSpouseId) {
      spouse.activeSpouseId = member.id
    }

    if (spouse.activeSpouseId !== member.id) {
      member.activeSpouseId = null
      continue
    }

    addMarriageHistory(member, spouse.id)
    addMarriageHistory(spouse, member.id)

    if (member.isDeceased || spouse.isDeceased) {
      dissolveMarriage(memberMap, member.id, spouse.id, RELATIONSHIP_STATUS.WIDOWED)
    }
  }

  for (const member of memberMap.values()) {
    closeMarriageIfPartnerDeceased(memberMap, member)
    member.parentIds = uniqueStrings(member.parentIds)
    member.childIds = uniqueStrings(member.childIds)
  }
}

function memberMapFromMembers(members = []) {
  const map = new Map()
  for (const rawMember of members) {
    if (!rawMember || typeof rawMember !== "object") continue
    const normalized = createMemberFromAny(rawMember)
    if (!normalized.id) continue
    map.set(normalized.id, normalized)
  }
  normalizeMemberMap(map)
  return map
}

function mergeLegacyMemberData(existing, person) {
  const merged = { ...existing }

  const assignIfMissing = (field, value) => {
    if (!hasValue(merged[field]) && hasValue(value)) {
      merged[field] = cleanText(value)
    }
  }

  assignIfMissing("firstName", person.firstName)
  assignIfMissing("lastName", person.lastName)

  if (!hasValue(merged.dob) && hasValue(person.dob)) {
    merged.dob = normalizeDate(person.dob)
  }

  assignIfMissing("placeOfBirth", person.placeOfBirth)
  assignIfMissing("occupation", person.occupation)
  assignIfMissing("currentAddress", person.currentAddress)
  assignIfMissing("gender", person.gender)

  if (!hasValue(merged.photo) && hasValue(person.photo)) {
    merged.photo = person.photo
  }

  if (!merged.isDeceased && person.isDeceased) {
    merged.isDeceased = true
    merged.dateOfDeath = normalizeDate(person.dateOfDeath)
  }

  return merged
}

function legacyToMemberMap(treeDocument) {
  const memberMap = new Map()
  const parentChildEdges = new Set()
  const spouseEdges = new Set()
  const visited = new Set()

  const addParentChildEdge = (parentId, childId) => {
    if (!parentId || !childId || parentId === childId) return
    parentChildEdges.add(`${parentId}->${childId}`)
  }

  const addSpouseEdge = (leftId, rightId) => {
    if (!leftId || !rightId || leftId === rightId) return
    const [a, b] = [leftId, rightId].sort()
    spouseEdges.add(`${a}<->${b}`)
  }

  const ensureMember = (person) => {
    const personId = cleanText(person?.id)
    if (!personId) return null

    if (!memberMap.has(personId)) {
      memberMap.set(personId, createMemberFromAny(person, { id: personId }))
      return memberMap.get(personId)
    }

    const merged = mergeLegacyMemberData(memberMap.get(personId), person)
    memberMap.set(personId, createMemberFromAny(merged, { id: personId }))
    return memberMap.get(personId)
  }

  const walk = (person) => {
    if (!person || typeof person !== "object") return

    const current = ensureMember(person)
    if (!current) return

    if (visited.has(current.id)) {
      if (Array.isArray(person.parentIds)) {
        for (const parentId of person.parentIds) {
          addParentChildEdge(cleanText(parentId), current.id)
        }
      }
      return
    }

    visited.add(current.id)

    if (Array.isArray(person.parentIds)) {
      for (const parentId of person.parentIds) {
        addParentChildEdge(cleanText(parentId), current.id)
      }
    }

    if (Array.isArray(person.children)) {
      for (const child of person.children) {
        const childMember = ensureMember(child)
        if (!childMember) continue
        addParentChildEdge(current.id, childMember.id)
        walk(child)
      }
    }

    if (Array.isArray(person.parents)) {
      for (const parent of person.parents) {
        const parentMember = ensureMember(parent)
        if (!parentMember) continue
        addParentChildEdge(parentMember.id, current.id)
        walk(parent)
      }
    }

    if (person.spouse) {
      const spouseMember = ensureMember(person.spouse)
      if (spouseMember) {
        addSpouseEdge(current.id, spouseMember.id)
        walk(person.spouse)
      }
    }

    if (hasValue(person.spouseId)) {
      addSpouseEdge(current.id, cleanText(person.spouseId))
    }
  }

  if (treeDocument.rootPerson) {
    walk(treeDocument.rootPerson)
  }

  if (Array.isArray(treeDocument.ancestors)) {
    for (const ancestor of treeDocument.ancestors) {
      walk(ancestor)
    }
  }

  for (const edge of parentChildEdges) {
    const [parentId, childId] = edge.split("->")
    linkParentChild(memberMap, parentId, childId)
  }

  for (const edge of spouseEdges) {
    const [leftId, rightId] = edge.split("<->")
    if (memberMap.has(leftId) && memberMap.has(rightId)) {
      try {
        marryMembers(memberMap, leftId, rightId)
      } catch {
        // Ignore conflicting legacy spouse links.
      }
    }
  }

  normalizeMemberMap(memberMap)
  return memberMap
}

function sortMembersForClient(a, b) {
  const aName = `${a.firstName} ${a.lastName}`.toLowerCase()
  const bName = `${b.firstName} ${b.lastName}`.toLowerCase()
  if (aName < bName) return -1
  if (aName > bName) return 1
  return a.id.localeCompare(b.id)
}

function sortByDobThenName(members) {
  return [...members].sort((a, b) => {
    const aDob = a.dob || "9999-12-31"
    const bDob = b.dob || "9999-12-31"

    if (aDob < bDob) return -1
    if (aDob > bDob) return 1

    const aName = `${a.firstName} ${a.lastName}`.toLowerCase()
    const bName = `${b.firstName} ${b.lastName}`.toLowerCase()

    if (aName < bName) return -1
    if (aName > bName) return 1
    return a.id.localeCompare(b.id)
  })
}

function mapToMemberList(memberMap) {
  return Array.from(memberMap.values()).sort(sortMembersForClient)
}

function makeClientMemberBase(member) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    dob: member.dob,
    placeOfBirth: member.placeOfBirth,
    occupation: member.occupation,
    currentAddress: member.currentAddress,
    gender: member.gender,
    photo: member.photo,
    isDeceased: member.isDeceased,
    dateOfDeath: member.dateOfDeath,
    parentIds: [...member.parentIds],
    childIds: [...member.childIds],
    activeSpouseId: member.activeSpouseId,
  }
}

function buildClientNode(memberId, memberMap, visited = new Set(), includeSpouse = true) {
  const member = memberMap.get(memberId)
  if (!member) return null

  const base = makeClientMemberBase(member)

  if (visited.has(memberId)) {
    return {
      ...base,
      spouse: null,
      children: [],
      parents: [],
    }
  }

  const nextVisited = new Set(visited)
  nextVisited.add(memberId)

  const children = sortByDobThenName(
    member.childIds
      .map((childId) => memberMap.get(childId))
      .filter(Boolean),
  ).map((child) => buildClientNode(child.id, memberMap, nextVisited, true))

  const parents = sortByDobThenName(
    member.parentIds
      .map((parentId) => memberMap.get(parentId))
      .filter(Boolean),
  ).map((parent) => buildClientNode(parent.id, memberMap, nextVisited, true))

  let spouse = null
  if (includeSpouse && member.activeSpouseId && memberMap.has(member.activeSpouseId)) {
    spouse = buildClientNode(member.activeSpouseId, memberMap, nextVisited, false)
  }

  return {
    ...base,
    spouse,
    children: children.filter(Boolean),
    parents: parents.filter(Boolean),
  }
}

function normalizeTreeCore(treeDocument) {
  const rootCandidateId = cleanText(treeDocument.rootPersonId || treeDocument.rootPerson?.id)
  const ownerUserId = objectIdFromUnknown(treeDocument.ownerUserId || treeDocument.userId)
  const editorUserIds = uniqueObjectIds(treeDocument.editorUserIds)

  let memberMap
  let changed = false

  if (Array.isArray(treeDocument.members) && treeDocument.members.length > 0) {
    memberMap = memberMapFromMembers(treeDocument.members)
  } else {
    memberMap = legacyToMemberMap(treeDocument)
    changed = true
  }

  let rootPersonId = rootCandidateId
  if (!rootPersonId || !memberMap.has(rootPersonId)) {
    const firstMember = memberMap.values().next().value
    rootPersonId = firstMember?.id || ""
    changed = true
  }

  const rootMember = rootPersonId ? memberMap.get(rootPersonId) : null
  const lastName = cleanText(treeDocument.lastName || rootMember?.lastName)
  const normalizedLastName = normalizeLastName(lastName)

  const normalized = {
    ...treeDocument,
    schemaVersion: TREE_SCHEMA_VERSION,
    lastName,
    normalizedLastName,
    rootPersonId,
    members: mapToMemberList(memberMap),
    ownerUserId: ownerUserId || null,
    userId: ownerUserId || treeDocument.userId || null,
    editorUserIds,
    updatedAt: treeDocument.updatedAt || new Date(),
    createdAt: treeDocument.createdAt || new Date(),
  }

  if (!treeDocument.schemaVersion || treeDocument.schemaVersion !== TREE_SCHEMA_VERSION) {
    changed = true
  }

  if (!treeDocument.normalizedLastName || treeDocument.normalizedLastName !== normalizedLastName) {
    changed = true
  }

  if (!Array.isArray(treeDocument.editorUserIds)) {
    changed = true
  }

  if (!treeDocument.ownerUserId && treeDocument.userId) {
    changed = true
  }

  return { tree: normalized, changed }
}

export function normalizeTreeDocument(treeDocument) {
  return normalizeTreeCore(treeDocument)
}

function serializableTreePayload(tree) {
  return {
    schemaVersion: tree.schemaVersion,
    lastName: tree.lastName,
    normalizedLastName: tree.normalizedLastName,
    rootPersonId: tree.rootPersonId,
    members: tree.members,
    ownerUserId: tree.ownerUserId,
    userId: tree.ownerUserId || tree.userId || null,
    editorUserIds: uniqueObjectIds(tree.editorUserIds),
    updatedAt: new Date(),
    createdAt: tree.createdAt || new Date(),
  }
}

export async function saveTree(db, tree) {
  const payload = serializableTreePayload(tree)
  await db.collection("familytrees").updateOne({ _id: tree._id }, { $set: payload })
  tree.updatedAt = payload.updatedAt
}

export async function loadTreeById(db, treeId) {
  const objectId = objectIdFromUnknown(treeId)
  if (!objectId) return null

  const rawTree = await db.collection("familytrees").findOne({ _id: objectId })
  if (!rawTree) return null

  const { tree, changed } = normalizeTreeCore(rawTree)
  if (changed) {
    await db.collection("familytrees").updateOne({ _id: tree._id }, { $set: serializableTreePayload(tree) })
  }

  return tree
}

export function buildTreeForClient(tree, focusPersonId = null) {
  const memberMap = memberMapFromMembers(tree.members)
  const selectedRootId = cleanText(focusPersonId) && memberMap.has(cleanText(focusPersonId)) ? cleanText(focusPersonId) : tree.rootPersonId

  const rootPerson = selectedRootId ? buildClientNode(selectedRootId, memberMap, new Set(), true) : null
  const allMembers = Array.from(memberMap.values())
    .sort(sortMembersForClient)
    .map((member) => ({
      ...makeClientMemberBase(member),
      spouseHistory: member.spouseHistory,
    }))

  return {
    _id: objectIdToString(tree._id),
    lastName: tree.lastName,
    normalizedLastName: tree.normalizedLastName,
    rootPersonId: selectedRootId,
    originalRootPersonId: tree.rootPersonId,
    rootPerson,
    allMembers,
    totalMembers: allMembers.length,
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt,
  }
}

export function buildTreeCardForClient(tree) {
  const memberMap = memberMapFromMembers(tree.members)
  const root = memberMap.get(tree.rootPersonId)

  return {
    _id: objectIdToString(tree._id),
    lastName: tree.lastName,
    rootPerson: root
      ? {
          firstName: root.firstName,
          lastName: root.lastName,
          photo: root.photo,
        }
      : null,
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt,
  }
}

export function canUserEditTree(tree, user) {
  if (!user) return false

  const userId = objectIdToString(user._id || user.userId)
  const ownerId = objectIdToString(tree.ownerUserId || tree.userId)

  if (userId && ownerId && userId === ownerId) return true

  const editorSet = new Set((tree.editorUserIds || []).map((id) => objectIdToString(id)))
  if (userId && editorSet.has(userId)) return true

  const userLastName = normalizeLastName(user.lastName)
  if (userLastName && userLastName === tree.normalizedLastName) return true

  return false
}

export function getTreePermissions(tree, user) {
  const ownerId = objectIdToString(tree.ownerUserId || tree.userId)
  const userId = objectIdToString(user?._id || user?.userId)
  const isOwner = Boolean(userId && ownerId && userId === ownerId)
  const canEdit = canUserEditTree(tree, user)

  let reason = "Read-only access"
  if (isOwner) {
    reason = "Tree owner"
  } else if (canEdit) {
    reason = "Surname verified for collaborative editing"
  }

  return {
    canView: true,
    canEdit,
    isOwner,
    reason,
  }
}

export function grantSurnameEditorAccess(tree, user) {
  if (!user) return false

  const normalizedUserLastName = normalizeLastName(user.lastName)
  if (!normalizedUserLastName || normalizedUserLastName !== tree.normalizedLastName) {
    return false
  }

  const userObjectId = objectIdFromUnknown(user._id || user.userId)
  if (!userObjectId) return false

  const userIdString = userObjectId.toHexString()
  const ownerIdString = objectIdToString(tree.ownerUserId || tree.userId)

  if (ownerIdString && ownerIdString === userIdString) return false

  const existingEditorIds = new Set((tree.editorUserIds || []).map((id) => objectIdToString(id)))
  if (existingEditorIds.has(userIdString)) return false

  tree.editorUserIds = [...(tree.editorUserIds || []), userObjectId]
  tree.updatedAt = new Date()
  return true
}

export function ensureWritableTree(tree) {
  const memberMap = memberMapFromMembers(tree.members)
  if (!tree.rootPersonId || !memberMap.has(tree.rootPersonId)) {
    const first = memberMap.values().next().value
    tree.rootPersonId = first?.id || ""
  }
  tree.members = mapToMemberList(memberMap)
  return memberMap
}

function validateBasicMemberInput(memberData, options = {}) {
  const { requireDob = true } = options

  if (!memberData || typeof memberData !== "object") {
    throw new Error("Invalid member data")
  }

  if (!hasValue(memberData.firstName)) {
    throw new Error("First name is required")
  }

  if (!hasValue(memberData.lastName)) {
    throw new Error("Last name is required")
  }

  if (!hasValue(memberData.gender)) {
    throw new Error("Gender is required")
  }

  if (requireDob) {
    if (!hasValue(memberData.dob)) {
      throw new Error("Date of birth is required")
    }

    const normalizedDob = normalizeDate(memberData.dob)
    if (!normalizedDob) {
      throw new Error("Invalid date of birth")
    }

    const date = new Date(normalizedDob)
    if (date > new Date()) {
      throw new Error("Date of birth cannot be in the future")
    }
  } else if (hasValue(memberData.dob)) {
    const normalizedDob = normalizeDate(memberData.dob)
    if (!normalizedDob) {
      throw new Error("Invalid date of birth")
    }

    const date = new Date(normalizedDob)
    if (date > new Date()) {
      throw new Error("Date of birth cannot be in the future")
    }
  }
}

function buildMemberForAdd(memberData, defaults = {}) {
  const payload = {
    firstName: cleanText(memberData.firstName),
    lastName: cleanText(memberData.lastName || defaults.lastName),
    dob: normalizeDate(memberData.dob),
    placeOfBirth: cleanText(memberData.placeOfBirth),
    occupation: cleanText(memberData.occupation),
    currentAddress: cleanText(memberData.currentAddress),
    gender: cleanText(memberData.gender || defaults.gender),
    photo: typeof memberData.photo === "string" ? memberData.photo : "",
    isDeceased: Boolean(memberData.isDeceased),
    dateOfDeath: normalizeDate(memberData.dateOfDeath),
  }

  return createMemberFromAny(payload)
}

function getMemberMapForMutation(tree) {
  return memberMapFromMembers(tree.members)
}

function syncMembersBackToTree(tree, memberMap) {
  normalizeMemberMap(memberMap)
  tree.members = mapToMemberList(memberMap)

  if (!tree.rootPersonId || !memberMap.has(tree.rootPersonId)) {
    const nextRoot = memberMap.values().next().value
    tree.rootPersonId = nextRoot?.id || ""
  }

  const root = memberMap.get(tree.rootPersonId)
  if (root && !hasValue(tree.lastName)) {
    tree.lastName = root.lastName
  }

  tree.normalizedLastName = normalizeLastName(tree.lastName)
  tree.schemaVersion = TREE_SCHEMA_VERSION
  tree.updatedAt = new Date()
}

function addChild(tree, memberData, parentId) {
  validateBasicMemberInput(memberData)

  const memberMap = getMemberMapForMutation(tree)
  const parent = memberMap.get(parentId)
  if (!parent) {
    throw new Error("Parent not found in tree")
  }

  closeMarriageIfPartnerDeceased(memberMap, parent)

  const child = buildMemberForAdd(memberData, { lastName: parent.lastName })
  child.parentIds = [parent.id]

  memberMap.set(child.id, child)
  linkParentChild(memberMap, parent.id, child.id)

  if (parent.activeSpouseId && memberMap.has(parent.activeSpouseId)) {
    linkParentChild(memberMap, parent.activeSpouseId, child.id)
  }

  syncMembersBackToTree(tree, memberMap)
  return child
}

function addSibling(tree, memberData, siblingId) {
  validateBasicMemberInput(memberData)

  const memberMap = getMemberMapForMutation(tree)
  const sibling = memberMap.get(siblingId)
  if (!sibling) {
    throw new Error("Sibling target not found")
  }

  if (!Array.isArray(sibling.parentIds) || sibling.parentIds.length === 0) {
    throw new Error("Cannot add sibling because the selected person has no parents linked")
  }

  const siblingMember = buildMemberForAdd(memberData, { lastName: sibling.lastName })
  memberMap.set(siblingMember.id, siblingMember)

  for (const parentId of sibling.parentIds) {
    linkParentChild(memberMap, parentId, siblingMember.id)
  }

  syncMembersBackToTree(tree, memberMap)
  return siblingMember
}

function addSpouse(tree, memberData, personId) {
  validateBasicMemberInput(memberData)

  const memberMap = getMemberMapForMutation(tree)
  const person = memberMap.get(personId)
  if (!person) {
    throw new Error("Person not found")
  }

  closeMarriageIfPartnerDeceased(memberMap, person)

  if (person.activeSpouseId) {
    throw new Error("Person already has an active spouse. Mark divorced or spouse deceased first.")
  }

  const spouse = buildMemberForAdd(memberData)
  if (spouse.id === person.id) {
    throw new Error("Invalid spouse")
  }

  memberMap.set(spouse.id, spouse)
  marryMembers(memberMap, person.id, spouse.id)

  syncMembersBackToTree(tree, memberMap)
  return spouse
}

function addParents(tree, memberData, childId) {
  const memberMap = getMemberMapForMutation(tree)
  const child = memberMap.get(childId)
  if (!child) {
    throw new Error("Child not found")
  }

  const existingParentCount = child.parentIds.length
  if (existingParentCount >= 2) {
    throw new Error("This person already has two parents")
  }

  const parentDrafts = []

  if (hasValue(memberData.fatherFirstName)) {
    const fatherDraft = {
      firstName: memberData.fatherFirstName,
      lastName: cleanText(memberData.fatherLastName) || child.lastName,
      dob: memberData.fatherDob,
      placeOfBirth: memberData.fatherPlaceOfBirth,
      occupation: memberData.fatherOccupation,
      currentAddress: memberData.currentAddress,
      gender: "male",
      photo: memberData.fatherPhoto,
      isDeceased: Boolean(memberData.fatherIsDeceased),
      dateOfDeath: memberData.fatherDateOfDeath,
    }
    validateBasicMemberInput(fatherDraft, { requireDob: false })
    parentDrafts.push(fatherDraft)
  }

  if (hasValue(memberData.motherFirstName)) {
    const motherDraft = {
      firstName: memberData.motherFirstName,
      lastName: cleanText(memberData.motherLastName) || child.lastName,
      dob: memberData.motherDob,
      placeOfBirth: memberData.motherPlaceOfBirth,
      occupation: memberData.motherOccupation,
      currentAddress: memberData.currentAddress,
      gender: "female",
      photo: memberData.motherPhoto,
      isDeceased: Boolean(memberData.motherIsDeceased),
      dateOfDeath: memberData.motherDateOfDeath,
    }
    validateBasicMemberInput(motherDraft, { requireDob: false })
    parentDrafts.push(motherDraft)
  }

  if (parentDrafts.length === 0) {
    throw new Error("At least one parent must be provided")
  }

  const availableSlots = 2 - existingParentCount
  if (parentDrafts.length > availableSlots) {
    throw new Error("Selected person already has one parent. Only one more parent can be added.")
  }

  const addedParents = []
  for (const draft of parentDrafts) {
    const parent = buildMemberForAdd(draft)
    memberMap.set(parent.id, parent)
    linkParentChild(memberMap, parent.id, child.id)
    addedParents.push(parent)
  }

  const latestChild = memberMap.get(child.id)
  if (latestChild.parentIds.length === 2) {
    const [firstParentId, secondParentId] = latestChild.parentIds
    const firstParent = memberMap.get(firstParentId)
    const secondParent = memberMap.get(secondParentId)

    if (firstParent && secondParent) {
      closeMarriageIfPartnerDeceased(memberMap, firstParent)
      closeMarriageIfPartnerDeceased(memberMap, secondParent)
      if (!firstParent.activeSpouseId && !secondParent.activeSpouseId) {
        marryMembers(memberMap, firstParent.id, secondParent.id)
      }
    }
  }

  syncMembersBackToTree(tree, memberMap)
  return addedParents
}

export function addMemberToTree(tree, memberType, relationTargetId, memberData) {
  const targetId = cleanText(relationTargetId)
  if (!targetId) {
    throw new Error("Target member is required")
  }

  switch (memberType) {
    case "child":
      return addChild(tree, memberData, targetId)
    case "sibling":
      return addSibling(tree, memberData, targetId)
    case "spouse":
      return addSpouse(tree, memberData, targetId)
    case "parent":
      return addParents(tree, memberData, targetId)
    default:
      throw new Error("Invalid member type")
  }
}

export function divorceMember(tree, memberId) {
  const cleanId = cleanText(memberId)
  if (!cleanId) {
    throw new Error("Member ID is required")
  }

  const memberMap = getMemberMapForMutation(tree)
  const member = memberMap.get(cleanId)
  if (!member) {
    throw new Error("Member not found")
  }

  if (!member.activeSpouseId) {
    throw new Error("No active spouse found for this member")
  }

  const spouse = memberMap.get(member.activeSpouseId)
  if (!spouse) {
    member.activeSpouseId = null
    syncMembersBackToTree(tree, memberMap)
    return
  }

  dissolveMarriage(memberMap, member.id, spouse.id, RELATIONSHIP_STATUS.DIVORCED)
  syncMembersBackToTree(tree, memberMap)
}

export function updateMemberInTree(tree, memberId, memberData) {
  const cleanId = cleanText(memberId)
  if (!cleanId) {
    throw new Error("Member ID is required")
  }

  const memberMap = getMemberMapForMutation(tree)
  const member = memberMap.get(cleanId)
  if (!member) {
    throw new Error("Member not found")
  }

  for (const field of PERSON_EDITABLE_FIELDS) {
    if (!(field in memberData)) continue

    if (field === "isDeceased") {
      member.isDeceased = Boolean(memberData.isDeceased)
      continue
    }

    if (field === "dob" || field === "dateOfDeath") {
      member[field] = normalizeDate(memberData[field])
      continue
    }

    if (field === "photo") {
      member.photo = typeof memberData.photo === "string" ? memberData.photo : ""
      continue
    }

    member[field] = cleanText(memberData[field])
  }

  if (!member.isDeceased) {
    member.dateOfDeath = ""
  }

  member.updatedAt = toIsoNow()

  if (member.isDeceased && member.activeSpouseId) {
    const spouse = memberMap.get(member.activeSpouseId)
    if (spouse) {
      dissolveMarriage(memberMap, member.id, spouse.id, RELATIONSHIP_STATUS.WIDOWED)
    }
  }

  syncMembersBackToTree(tree, memberMap)
}

export function deleteMemberFromTree(tree, memberId) {
  const cleanId = cleanText(memberId)
  if (!cleanId) {
    throw new Error("Member ID is required")
  }

  if (tree.rootPersonId === cleanId) {
    throw new Error("Cannot delete the root person of the family tree")
  }

  const memberMap = getMemberMapForMutation(tree)
  const member = memberMap.get(cleanId)
  if (!member) {
    throw new Error("Member not found")
  }

  if (member.activeSpouseId && memberMap.has(member.activeSpouseId)) {
    dissolveMarriage(memberMap, member.id, member.activeSpouseId, RELATIONSHIP_STATUS.DIVORCED)
  }

  for (const parentId of member.parentIds) {
    unlinkParentChild(memberMap, parentId, member.id)
  }

  for (const childId of member.childIds) {
    unlinkParentChild(memberMap, member.id, childId)
  }

  for (const other of memberMap.values()) {
    other.parentIds = other.parentIds.filter((id) => id !== member.id)
    other.childIds = other.childIds.filter((id) => id !== member.id)

    if (other.activeSpouseId === member.id) {
      other.activeSpouseId = null
      addHistoryEntry(other, member.id, RELATIONSHIP_STATUS.DIVORCED)
    }

    other.spouseHistory = other.spouseHistory.filter((entry) => entry.partnerId !== member.id || entry.endedAt)
  }

  memberMap.delete(member.id)
  syncMembersBackToTree(tree, memberMap)
}

export function createTreeDocument({ ownerUserId, lastName, rootMember }) {
  const ownerId = objectIdFromUnknown(ownerUserId)
  if (!ownerId) {
    throw new Error("Invalid owner ID")
  }

  const member = createMemberFromAny(rootMember)
  const now = new Date()

  return {
    schemaVersion: TREE_SCHEMA_VERSION,
    lastName: cleanText(lastName || member.lastName),
    normalizedLastName: normalizeLastName(lastName || member.lastName),
    rootPersonId: member.id,
    members: [member],
    ownerUserId: ownerId,
    userId: ownerId,
    editorUserIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function isSameUser(userLikeA, userLikeB) {
  const a = objectIdToString(userLikeA)
  const b = objectIdToString(userLikeB)
  return Boolean(a && b && a === b)
}
