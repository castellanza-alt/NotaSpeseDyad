import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { User } from "lucide-react";

interface UserAvatarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ className, size = "md" }: UserAvatarProps) {
  const { user } = useAuth();
  
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email;
  const initials = displayName
    ? displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <Avatar className={`${sizeClasses[size]} ${className || ""} ring-2 ring-background shadow-sm`}>
      <AvatarImage 
        src={avatarUrl} 
        alt={displayName || "User"} 
        className="object-cover"
      />
      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
        {avatarUrl ? <User className="w-4 h-4" strokeWidth={1.5} /> : initials}
      </AvatarFallback>
    </Avatar>
  );
}
