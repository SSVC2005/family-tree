import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { buildTreeForClient, canUserEditTree, grantSurnameEditorAccess, loadTreeById, saveTree } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function GET(request, { params }) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse, decoded } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const tree = await loadTreeById(db, params.id)
    if (!tree) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    const granted = grantSurnameEditorAccess(tree, user)
    if (granted) {
      await saveTree(db, tree)
    }

    if (!canUserEditTree(tree, user)) {
      return Response.json({ message: "Forbidden: You do not have permission to export this tree" }, { status: 403 })
    }

    const familyTreeForClient = buildTreeForClient(tree)

    const exportData = {
      familyTree: familyTreeForClient,
      metadata: {
        exportDate: new Date().toISOString(),
        totalMembers: familyTreeForClient.totalMembers,
        treeId: String(tree._id),
        lastName: tree.lastName,
        rootPerson: `${familyTreeForClient.rootPerson?.firstName || ""} ${familyTreeForClient.rootPerson?.lastName || ""}`.trim(),
        exportedBy: `${decoded.firstName} ${decoded.lastName}`,
      },
    }

    return Response.json(exportData)
  } catch (error) {
    console.error("Export family tree error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
