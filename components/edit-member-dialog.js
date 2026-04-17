"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, AlertTriangle, Unlink2 } from "lucide-react"
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

export default function EditMemberDialog({ open, onOpenChange, person, treeId, onMemberUpdated, tree }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    placeOfBirth: "",
    fatherName: "",
    motherName: "",
    occupation: "",
    currentAddress: "",
    gender: "",
    photo: "",
    isDeceased: false,
    dateOfDeath: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isMinor, setIsMinor] = useState(false)

  // Populate form when dialog opens
  useEffect(() => {
    if (open && person) {
      setFormData({
        firstName: person.firstName || "",
        lastName: person.lastName || "",
        dob: person.dob || "",
        placeOfBirth: person.placeOfBirth || "",
        fatherName: person.fatherName || "",
        motherName: person.motherName || "",
        occupation: person.occupation || "",
        currentAddress: person.currentAddress || "",
        gender: person.gender || "",
        photo: person.photo || "",
        isDeceased: person.isDeceased || false,
        dateOfDeath: person.dateOfDeath || "",
      })
      setError("")
    }
  }, [open, person])

  // Check if person is minor based on DOB
  useEffect(() => {
    if (formData.dob) {
      const age = Math.floor((new Date() - new Date(formData.dob)) / (365.25 * 24 * 60 * 60 * 1000))
      setIsMinor(age < 18)

      // Clear occupation if minor
      if (age < 18 && formData.occupation) {
        setFormData((prev) => ({ ...prev, occupation: "" }))
      }
    }
  }, [formData.dob])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSelectChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFormData({
          ...formData,
          photo: e.target.result,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const requestBody = {
        memberData: formData,
        memberId: person.id,
      }

      const response = await fetch(`/api/family-trees/${treeId}/edit-member`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.ok) {
        onMemberUpdated()
        onOpenChange(false)
      } else {
        setError(data.message || "Failed to update member")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {person?.firstName} {person?.lastName}
          </DialogTitle>
          <DialogDescription>Update the information for this family member.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="Enter first name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} required />
              {isMinor && <p className="text-sm text-blue-600">Person is under 18 - occupation field will be hidden</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select onValueChange={(value) => handleSelectChange("gender", value)} value={formData.gender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Photo (Optional)</Label>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-300 overflow-hidden flex items-center justify-center">
                {formData.photo ? (
                  <img
                    src={formData.photo || "/placeholder.svg"}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <Input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">Upload a photo (JPG, PNG, GIF)</p>
              </div>
              {formData.photo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, photo: "" })}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placeOfBirth">Place of Birth</Label>
            <Input
              id="placeOfBirth"
              name="placeOfBirth"
              value={formData.placeOfBirth}
              onChange={handleChange}
              placeholder="Enter place of birth"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fatherName">Father's Name</Label>
              <Input
                id="fatherName"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleChange}
                placeholder="Father's name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motherName">Mother's Name</Label>
              <Input
                id="motherName"
                name="motherName"
                value={formData.motherName}
                onChange={handleChange}
                placeholder="Mother's name"
              />
            </div>
          </div>

          {!isMinor && (
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                placeholder="Enter occupation"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentAddress">Current Address</Label>
            <Input
              id="currentAddress"
              name="currentAddress"
              value={formData.currentAddress}
              onChange={handleChange}
              placeholder="Enter current address"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isDeceased || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isDeceased: e.target.checked,
                    dateOfDeath: e.target.checked ? formData.dateOfDeath : "",
                  })
                }
              />
              <span>Has passed away</span>
            </Label>
            {formData.isDeceased && (
              <div className="space-y-2">
                <Label htmlFor="dateOfDeath">Date of Death</Label>
                <Input
                  id="dateOfDeath"
                  name="dateOfDeath"
                  type="date"
                  value={formData.dateOfDeath || ""}
                  onChange={handleChange}
                  placeholder="Date of death"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Member"}
            </Button>
            {person?.spouse && !person?.isDeceased && !person?.spouse?.isDeceased && (
              <Button
                type="button"
                variant="destructive"
                disabled={loading}
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("token")
                    const response = await fetch(`/api/family-trees/${treeId}/edit-member`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        memberId: person.id,
                        action: "divorceCurrentSpouse",
                      }),
                    })

                    const data = await response.json()
                    if (response.ok) {
                      onMemberUpdated()
                      onOpenChange(false)
                    } else {
                      alert(data.message || "Failed to divorce spouse")
                    }
                  } catch (error) {
                    alert("An error occurred while divorcing spouse")
                  }
                }}
              >
                <Unlink2 className="h-4 w-4 mr-1" />
                Divorce
              </Button>
            )}
            {person?.id !== tree?.rootPerson?.id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={loading}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                      Delete Family Member
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete{" "}
                      <strong>
                        {person?.firstName} {person?.lastName}
                      </strong>{" "}
                      from the family tree? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("token")
                          const response = await fetch(
                            `/api/family-trees/${treeId}/delete-member?memberId=${person.id}`,
                            {
                              method: "DELETE",
                              headers: {
                                Authorization: `Bearer ${token}`,
                              },
                            },
                          )

                          if (response.ok) {
                            onMemberUpdated()
                            onOpenChange(false)
                          } else {
                            const data = await response.json()
                            alert(data.message || "Failed to delete member")
                          }
                        } catch (error) {
                          alert("An error occurred while deleting the member")
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
