import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { loadTreeById } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function DELETE(request, { params }) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const tree = await loadTreeById(db, params.id)
    if (!tree) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    const ownerId = String(tree.ownerUserId || tree.userId || "")
    if (ownerId !== String(user._id)) {
      return Response.json({ message: "Forbidden: Only the owner can delete this tree" }, { status: 403 })
    }

    const result = await db.collection("familytrees").deleteOne({
      _id: new ObjectId(params.id),
    })

    if (result.deletedCount === 0) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    return Response.json({ message: "Family tree deleted successfully" })
  } catch (error) {
    console.error("Delete family tree error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
