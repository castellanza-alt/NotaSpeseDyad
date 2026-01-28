import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { ArchiveScreen } from "@/components/ArchiveScreen";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="shimmer w-16 h-16 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <ArchiveScreen />;
};

export default Index;
