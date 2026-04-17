import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import {
  canUserEditTree,
  deleteMemberFromTree,
  grantSurnameEditorAccess,
  loadTreeById,
  saveTree,
} from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")

    if (!memberId) {
      return Response.json({ message: "Member ID is required" }, { status: 400 })
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
      deleteMemberFromTree(tree, memberId)
    } catch (mutationError) {
      return Response.json({ message: mutationError.message || "Failed to delete member" }, { status: 400 })
    }

    await saveTree(db, tree)

    return Response.json({ message: "Member deleted successfully" })
  } catch (error) {
    console.error("Delete member error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
