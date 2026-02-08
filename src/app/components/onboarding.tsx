import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useCompleteOnboarding, useUserProfile } from "../../hooks/useOnboarding";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User,
  Building2,
  Briefcase,
  Sparkles,
  BarChart3,
  Users,
  Search,
} from "lucide-react";

interface OnboardingProps {
  onNavigate?: (path: string) => void;
}

export function Onboarding({ onNavigate }: OnboardingProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const completeOnboarding = useCompleteOnboarding();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    company: "",
    role: "",
    useCase: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill name from profile if available
  useEffect(() => {
    if (profile?.full_name && !formData.fullName) {
      setFormData((prev) => ({ ...prev, fullName: profile.full_name || "" }));
    }
  }, [profile]);

  const roles = [
    { value: "creator_manager", label: "Creator Manager", icon: Users },
    { value: "brand_manager", label: "Brand Manager", icon: Briefcase },
    { value: "agency", label: "Agency", icon: Building2 },
    { value: "marketer", label: "Marketer", icon: BarChart3 },
    { value: "other", label: "Other", icon: User },
  ];

  const useCases = [
    { value: "campaign_management", label: "Campaign Management", icon: Briefcase },
    { value: "creator_discovery", label: "Creator Discovery", icon: Search },
    { value: "analytics", label: "Analytics & Reporting", icon: BarChart3 },
    { value: "relationship_management", label: "Relationship Management", icon: Users },
    { value: "content_tracking", label: "Content Tracking", icon: Sparkles },
  ];

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.fullName.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!formData.role) {
        toast.error("Please select your role");
        return;
      }
      if (!formData.useCase) {
        toast.error("Please select your primary use case");
        return;
      }
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding.mutateAsync({
        full_name: formData.fullName,
      });
      
      // Navigate to dashboard
      setTimeout(() => {
        if (onNavigate) {
          onNavigate("/");
        } else {
          navigate("/");
        }
      }, 500);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Step {currentStep} of 2</span>
            <span className="text-sm text-muted-foreground">
              {Math.round((currentStep / 2) * 100)}% Complete
            </span>
          </div>
          <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-red-400 dark:to-cyan-400 transition-all duration-300"
              style={{ width: `${(currentStep / 2) * 100}%` }}
            />
          </div>
        </div>

        <Card className="bg-card border-border shadow-2xl">
          <CardContent className="p-8">
            {/* Step 1: Welcome & Name */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">
                    Welcome to DTTracker!
                  </h2>
                  <p className="text-muted-foreground">
                    Let's get you set up in just a few steps
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Full Name *
                    </label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      className="h-11 bg-muted/50 border-border/70 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Company / Organization <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Acme Inc."
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      className="h-11 bg-muted/50 border-border/70 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleNext}
                    disabled={!formData.fullName.trim()}
                    className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Preferences */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold text-foreground mb-2">
                    Tell us about yourself
                  </h2>
                  <p className="text-muted-foreground">
                    Help us personalize your experience
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-3">
                      What's your role? *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {roles.map((role) => {
                        const Icon = role.icon;
                        const isSelected = formData.role === role.value;
                        return (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, role: role.value })
                            }
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border/70 bg-muted/30 hover:border-border/80 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/60 text-muted-foreground"
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <span
                                className={`font-medium ${
                                  isSelected ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {role.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-3">
                      What's your primary use case? *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {useCases.map((useCase) => {
                        const Icon = useCase.icon;
                        const isSelected = formData.useCase === useCase.value;
                        return (
                          <button
                            key={useCase.value}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, useCase: useCase.value })
                            }
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border/70 bg-muted/30 hover:border-border/80 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/60 text-muted-foreground"
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <span
                                className={`font-medium ${
                                  isSelected ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {useCase.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    onClick={handleBack}
                    variant="outline"
                    className="h-11 px-6 bg-muted/50 hover:bg-muted/70 border-border/70 text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={
                      !formData.role ||
                      !formData.useCase ||
                      isSubmitting ||
                      completeOnboarding.isPending
                    }
                    className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    {isSubmitting || completeOnboarding.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                        Getting Started...
                      </>
                    ) : (
                      <>
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
