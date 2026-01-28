import { useState, useRef } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { SettingsSheet } from "./SettingsSheet";
import { RecentExpenses } from "./RecentExpenses";
import { ImageAnalyzer } from "./ImageAnalyzer";
import { ThemeToggle } from "./ThemeToggle";
import { UserAvatar } from "./UserAvatar";

export function HomeScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const handleSelectPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
    e.target.value = "";
  };

  const handleClose = () => {
    setSelectedImage(null);
  };

  const handleSuccess = () => {
    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hidden file input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Header with glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-40 glass animate-slide-down">
        <div className="flex items-center justify-between px-5 pt-safe-top pb-4">
          {/* Left: App Name */}
          <h1 className="font-semibold text-lg text-foreground tracking-tight">
            Nota Spese
          </h1>

          {/* Right: Theme Toggle, Avatar, Settings */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserAvatar size="sm" />
            <SettingsSheet />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-32 pb-48">
        {/* Hero Section */}
        <div className="text-center mb-10 animate-fade-in">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6"
               style={{ animationDelay: "100ms" }}>
            <FileText className="w-9 h-9 text-primary" strokeWidth={1.5} />
          </div>
          
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Registra una Spesa
          </h2>
          <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
            Seleziona un giustificativo per analizzarlo e inviarlo all'amministrazione
          </p>
        </div>

        {/* Main Action Button - Pill shaped */}
        <div className="animate-scale-in" style={{ animationDelay: "200ms" }}>
          <button
            onClick={handleSelectPhoto}
            className="group flex items-center gap-3 px-8 py-4 rounded-full
                       bg-primary text-primary-foreground font-medium
                       shadow-lg shadow-primary/25
                       transition-all duration-300 ease-out
                       hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]
                       active:scale-[0.98]"
          >
            <span className="text-base">Inserisci Giustificativo</span>
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </button>
        </div>
      </main>

      {/* Recent Expenses - Fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 glass">
        <div className="px-5 pt-4 pb-safe-bottom">
          <RecentExpenses />
        </div>
      </footer>

      {/* Image Analyzer Modal */}
      {selectedImage && (
        <ImageAnalyzer 
          imageFile={selectedImage} 
          onClose={handleClose} 
          onSuccess={handleSuccess} 
        />
      )}
    </div>
  );
}
