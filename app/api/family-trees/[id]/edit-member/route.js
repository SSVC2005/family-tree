import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import {
  canUserEditTree,
  divorceMember,
  grantSurnameEditorAccess,
  loadTreeById,
  saveTree,
  updateMemberInTree,
} from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

function isValidPastDate(value) {
  if (!value) return true
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date <= new Date()
}

export async function PUT(request, { params }) {
  try {
    const { memberData = {}, memberId, action } = await request.json()

    if (memberData.dob && !isValidPastDate(memberData.dob)) {
      return Response.json({ message: "Invalid date of birth" }, { status: 400 })
    }
    if (memberData.dateOfDeath && !isValidPastDate(memberData.dateOfDeath)) {
      return Response.json({ message: "Invalid date of death" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const tree = await loadTreeById(db, params.id)
    if (!tree) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    grantSurnameEditorAccess(tree, user)
    if (!canUserEditTree(tree, user)) {
      return Response.json({ message: "Forbidden: You do not have permission to edit this tree" }, { status: 403 })
    }

    try {
      if (action === "divorceCurrentSpouse") {
        divorceMember(tree, memberId)
      } else {
        updateMemberInTree(tree, memberId, memberData)
      }
    } catch (mutationError) {
      return Response.json({ message: mutationError.message || "Failed to update member" }, { status: 400 })
    }

    await saveTree(db, tree)

    return Response.json({ message: action === "divorceCurrentSpouse" ? "Spouse disconnected successfully" : "Member updated successfully" })
  } catch (error) {
    console.error("Edit member error:", error)
    return Response.json({ message: error.message || "Internal server error" }, { status: 500 })
  }
}
