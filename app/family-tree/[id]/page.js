"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Plus, Users, Trash2, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import AddMemberDialog from "@/components/add-member-dialog"
import FamilyTreeVisualization from "@/components/family-tree-visualization"

export default function FamilyTreePage({ params }) {
  const [familyTree, setFamilyTree] = useState(null)
  const [permissions, setPermissions] = useState({ canView: true, canEdit: false, isOwner: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [addMemberType, setAddMemberType] = useState("")
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    fetchFamilyTree()
  }, [params.id, router])

  const fetchFamilyTree = async (focusPersonId = "") => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const query = focusPersonId ? `?focusPersonId=${encodeURIComponent(focusPersonId)}` : ""
      const response = await fetch(`/api/family-trees/${params.id}${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setFamilyTree(data.tree)
        setPermissions(data.permissions || { canView: true, canEdit: false, isOwner: false })
        setError("")
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.message || "Failed to fetch family tree")
      }
    } catch (error) {
      setError("An error occurred while fetching the family tree")
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = (person, type) => {
    setSelectedPerson(person)
    setAddMemberType(type)
    setShowAddMember(true)
  }

  const handleMemberAdded = () => {
    setShowAddMember(false)
    setSelectedPerson(null)
    setAddMemberType("")
    setTimeout(() => {
      fetchFamilyTree(familyTree?.rootPersonId || "")
    }, 100)
  }

  const handleMemberDeleted = () => {
    setTimeout(() => {
      fetchFamilyTree(familyTree?.rootPersonId || "")
    }, 100)
  }

  const handleSetRootPerson = (personId) => {
    if (!personId) return
    fetchFamilyTree(personId)
  }

  const handleResetToOriginalRoot = () => {
    if (!familyTree?.originalRootPersonId) return
    fetchFamilyTree(familyTree.originalRootPersonId)
  }

  const handleDeleteTree = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/family-trees/${params.id}/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        router.push("/dashboard")
      } else {
        const data = await response.json()
        setError(data.message || "Failed to delete family tree")
      }
    } catch (error) {
      setError("An error occurred while deleting the family tree")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-600">Loading family tree...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{familyTree?.lastName} Family Tree</h1>
              <p className="text-gray-600">
                Focus Root: {familyTree?.rootPerson?.firstName} {familyTree?.rootPerson?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {familyTree?.originalRootPersonId && familyTree?.rootPersonId !== familyTree?.originalRootPersonId && (
              <Button variant="outline" onClick={handleResetToOriginalRoot}>
                Reset Root
              </Button>
            )}

            {permissions.canEdit && (
              <Button onClick={() => handleAddMember(familyTree?.rootPerson, "child")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            )}

            {permissions.isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Tree
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                      Delete Family Tree
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the entire <strong>{familyTree?.lastName} Family Tree</strong>? This
                      action cannot be undone and will permanently remove all family members and their information.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTree} className="bg-red-600 hover:bg-red-700">
                      Delete Entire Tree
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {familyTree && (
          <FamilyTreeVisualization
            tree={familyTree}
            onAddMember={handleAddMember}
            onMemberDeleted={handleMemberDeleted}
            treeId={params.id}
            onSetRootPerson={handleSetRootPerson}
            permissions={permissions}
          />
        )}
      </div>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        selectedPerson={selectedPerson}
        memberType={addMemberType}
        treeId={params.id}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  )
}
