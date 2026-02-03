import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Share2, TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { format, subMonths, isSameMonth, startOfMonth, endOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface MonthlyRecapProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MonthlyRecap({ isOpen, onClose }: MonthlyRecapProps) {
  const { expenses } = useExpenses();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { theme } = useTheme();
  
  // Calculate Data for LAST MONTH (assuming current is Feb 2026 for demo, or real last month)
  // For robustness, let's use the most recent complete month data available or just the current month context.
  // Let's analyze the CURRENT month vs PREVIOUS month.
  const targetDate = new Date(); // Or consistent with app: new Date(2026, 1, 1) if we want to force that context
  const currentMonthExpenses = useMemo(() => 
    expenses.filter(e => e.expense_date && isSameMonth(new Date(e.expense_date), targetDate)), 
  [expenses, targetDate]);
  
  const totalSpent = useMemo(() => 
    currentMonthExpenses.reduce((acc, curr) => acc + (curr.total || 0), 0), 
  [currentMonthExpenses]);

  const topCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    currentMonthExpenses.forEach(e => {
        const cat = e.category || "Altro";
        counts[cat] = (counts[cat] || 0) + (e.total || 0);
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ["Nessuna", 0];
  }, [currentMonthExpenses]);

  const slides = [
    {
      id: "intro",
      bg: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-white">
          <motion.div 
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
            className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-6"
          >
            <Calendar className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className="text-4xl font-black mb-2">Il tuo {format(targetDate, "MMMM", { locale: it })}</h2>
          <p className="text-xl opacity-90">Pronto a vedere come è andata?</p>
        </div>
      )
    },
    {
      id: "total",
      bg: "bg-gradient-to-tr from-emerald-500 to-teal-700",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-white">
          <p className="text-lg font-medium opacity-80 mb-2 uppercase tracking-widest">Totale Speso</p>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-black mb-6 tracking-tighter"
          >
            €{totalSpent.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
          </motion.h1>
          <div className="flex gap-2 items-center bg-white/10 px-4 py-2 rounded-full">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">Portafoglio piange?</span>
          </div>
        </div>
      )
    },
    {
      id: "category",
      bg: "bg-gradient-to-bl from-orange-400 to-rose-600",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-white">
           <p className="text-lg font-medium opacity-80 mb-6">Il tuo "Vizio" principale</p>
           <motion.div 
             initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
             className="bg-white text-rose-600 px-8 py-4 rounded-3xl shadow-xl mb-4"
           >
             <h2 className="text-3xl font-bold">{topCategory[0]}</h2>
           </motion.div>
           <p className="text-2xl font-light">
             Hai speso <span className="font-bold">€{topCategory[1].toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
           </p>
        </div>
      )
    },
    {
        id: "outro",
        bg: "bg-black",
        content: (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-white">
                <h2 className="text-3xl font-bold mb-8">Alla prossima!</h2>
                <button onClick={onClose} className="bg-white text-black px-8 py-3 rounded-full font-bold text-lg hover:scale-105 transition-transform">
                    Chiudi Recap
                </button>
            </div>
        )
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(curr => curr + 1);
    else onClose();
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(curr => curr - 1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black flex flex-col"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-safe-top">
          {slides.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white"
                initial={{ width: "0%" }}
                animate={{ width: idx < currentSlide ? "100%" : idx === currentSlide ? "100%" : "0%" }}
                transition={{ duration: idx === currentSlide ? 5 : 0.3, ease: "linear" }} // Auto-advance logic could be added here
              />
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/80 hover:text-white pt-safe-top">
          <X className="w-8 h-8" />
        </button>

        {/* Slide Content */}
        <div className="flex-1 relative overflow-hidden" onClick={(e) => {
            const width = window.innerWidth;
            if (e.clientX > width / 2) nextSlide();
            else prevSlide();
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
              className={cn("absolute inset-0 flex flex-col", slides[currentSlide].bg)}
            >
              {slides[currentSlide].content}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
