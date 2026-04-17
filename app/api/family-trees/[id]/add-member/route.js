import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { addMemberToTree, canUserEditTree, grantSurnameEditorAccess, loadTreeById, saveTree } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function POST(request, { params }) {
  try {
    const { memberData, memberType, parentId } = await request.json()

    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const tree = await loadTreeById(db, params.id)
    if (!tree) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    const granted = grantSurnameEditorAccess(tree, user)
    const canEdit = canUserEditTree(tree, user)
    if (!canEdit) {
      return Response.json(
        {
          message: "Forbidden: You can edit this tree only if you own it or your surname matches the tree surname",
        },
        { status: 403 },
      )
    }

    try {
      addMemberToTree(tree, memberType, parentId, memberData || {})
    } catch (mutationError) {
      return Response.json({ message: mutationError.message || "Failed to add member" }, { status: 400 })
    }

    if (granted) {
      // granted flag already reflected in tree object
    }

    await saveTree(db, tree)

    return Response.json({ message: "Member added successfully" })
  } catch (error) {
    console.error("Add member error:", error)
    return Response.json({ message: error.message || "Internal server error" }, { status: 500 })
  }
}
