import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  photoUrl?: string | null;
  onPhotoChange?: (photoUrl: string | null) => void;
  cvId?: string;
}

export default function PhotoUpload({ photoUrl, onPhotoChange, cvId }: PhotoUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch('/api/cvs/photo/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (onPhotoChange) {
        onPhotoChange(data.photoUrl);
      }
      toast({
        title: "Success!",
        description: "Photo uploaded and processed successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // If cvId exists, delete from server (DB + filesystem)
      if (cvId) {
        const response = await apiRequest("DELETE", `/api/cvs/photo/${cvId}`, {});
        return response.json();
      }
      
      // If no cvId (new CV), just return success - we'll clear state locally
      // The orphaned file will be cleaned up by the server eventually
      return { success: true };
    },
    onSuccess: () => {
      if (onPhotoChange) {
        onPhotoChange(null);
      }
      toast({
        title: "Success!",
        description: "Photo removed successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Card className="p-6">
      <h4 className="text-lg font-semibold mb-4" data-testid="text-photo-upload-title">
        Profile Photo
      </h4>
      <p className="text-sm text-muted-foreground mb-4">
        Upload a professional photo for your CV. We'll automatically crop it to a perfect circle.
      </p>

      <div className="flex items-center gap-6">
        {/* Photo Preview */}
        <div className="relative">
          <Avatar className="h-32 w-32" data-testid="avatar-photo-preview">
            <AvatarImage src={photoUrl || undefined} alt="Profile photo" />
            <AvatarFallback className="bg-muted">
              <User className="h-16 w-16 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          {photoUrl && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-photo"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            data-testid="input-file-photo"
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={handleUploadClick}
            disabled={isUploading}
            data-testid="button-upload-photo"
          >
            <Upload className="mr-2 h-4 w-4" />
            {photoUrl ? 'Change Photo' : 'Upload Photo'}
          </Button>
          
          {isUploading && (
            <p className="text-sm text-muted-foreground mt-2">
              Processing your photo...
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Supported formats: JPEG, PNG. Maximum size: 5MB.
      </p>
    </Card>
  );
}
