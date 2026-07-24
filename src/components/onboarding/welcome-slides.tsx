'use client';

// ============================================================
// MODUL 39.1: Welcome Slides — First-run experience
// 3 slides max, skip-able at any point
// Slide 1: File Storage
// Slide 2: Notes
// Slide 3: Calculator & Command Palette
// Animate transitions with framer-motion
// ============================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderUp, FileText, Calculator, Command, SkipForward, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface WelcomeSlidesProps {
  onComplete: () => void;
  onDismiss: () => void;
}

const SLIDES = [
  {
    id: 1,
    title: 'File Storage',
    description: 'Upload and organize your files with drag & drop. Create folders to keep everything neat.',
    icon: FolderUp,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
  },
  {
    id: 2,
    title: 'Notes',
    description: 'Write rich text notes with backlinks and database blocks to structure your ideas.',
    icon: FileText,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
  },
  {
    id: 3,
    title: 'Calculator & Command Palette',
    description: 'Press Ctrl+K for quick actions, Ctrl+Shift+K for the built-in calculator.',
    icon: Calculator,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/20',
  },
];

export function WelcomeSlides({ onComplete, onDismiss }: WelcomeSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  }, [currentSlide, onComplete]);

  const handleSkip = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const slide = SLIDES[currentSlide];
  const progressValue = ((currentSlide + 1) / SLIDES.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md mx-4 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="px-6 pt-4">
          <Progress value={progressValue} className="h-1.5" />
        </div>

        {/* Slide content */}
        <div className="px-6 pt-8 pb-6 min-h-[280px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              {/* Icon */}
              <div className={`w-20 h-20 rounded-2xl ${slide.bg} flex items-center justify-center mb-6`}>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                >
                  <slide.icon className={`h-10 w-10 ${slide.color}`} />
                </motion.div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2">{slide.title}</h2>

              {/* Description */}
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 pb-4">
          {SLIDES.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}: ${s.title}`}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                index === currentSlide
                  ? 'bg-primary scale-125'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="min-h-[44px] text-muted-foreground hover:text-foreground"
            aria-label="Skip welcome slides"
          >
            <SkipForward className="h-4 w-4 mr-1" />
            Skip
          </Button>

          <Button
            onClick={handleNext}
            className="min-h-[44px]"
            aria-label={currentSlide === SLIDES.length - 1 ? 'Get started' : 'Next slide'}
          >
            {currentSlide === SLIDES.length - 1 ? (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
