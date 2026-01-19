import { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookDemoModal({ isOpen, onClose }: BookDemoModalProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    role: '',
    budget: '',
    platform: '',
    date: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  const handleNext = () => {
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        style={{ backgroundColor: 'var(--overlay)' }}
      />

      {/* Modal - Mobile: Full screen slide-over, Desktop: Centered modal */}
      <div 
        className="absolute inset-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-[520px] lg:max-h-[90vh] bg-black border-0 lg:border lg:border-[#1F1F1F] lg:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ 
          borderRadius: '16px'
        }}
      >
        {!isSubmitted ? (
          <>
            {/* Header */}
            <div 
              className="flex-shrink-0 flex items-center justify-between p-6 border-b border-[#1F1F1F]"
              style={{ padding: '24px' }}
            >
              <div>
                <h2 
                  className="text-xl lg:text-2xl font-bold text-white"
                  style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                >
                  Book Your Demo
                </h2>
                <p 
                  className="text-sm text-[#A1A1A1] mt-1"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Step {step} of 2
                </p>
              </div>
              <button 
                onClick={onClose}
                className="w-11 h-11 flex items-center justify-center text-[#A1A1A1] hover:text-white transition-colors"
                aria-label="Close"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Scrollable Form */}
            <div 
              className="flex-1 overflow-y-auto p-6"
              style={{ padding: '24px' }}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {step === 1 ? (
                  <>
                    <p 
                      className="text-sm text-[#A1A1A1] mb-4"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      See DTTracker in action with a personalized walkthrough.
                    </p>

                    <div>
                      <Label 
                        htmlFor="name" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Full Name *
                      </Label>
                      <Input 
                        id="name"
                        placeholder="John Doe"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-[#111111] border-[#1F1F1F] text-white placeholder:text-[#A1A1A1] focus:border-[#E50914] h-12 rounded-xl"
                        style={{ 
                          height: '48px',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-body)'
                        }}
                      />
                    </div>

                    <div>
                      <Label 
                        htmlFor="company" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Company
                      </Label>
                      <Input 
                        id="company"
                        placeholder="Your label, agency, or artist name"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="bg-[#111111] border-[#1F1F1F] text-white placeholder:text-[#A1A1A1] focus:border-[#E50914] h-12 rounded-xl"
                        style={{ 
                          height: '48px',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-body)'
                        }}
                      />
                    </div>

                    <div>
                      <Label 
                        htmlFor="email" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Work Email *
                      </Label>
                      <Input 
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-[#111111] border-[#1F1F1F] text-white placeholder:text-[#A1A1A1] focus:border-[#E50914] h-12 rounded-xl"
                        style={{ 
                          height: '48px',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-body)'
                        }}
                      />
                    </div>

                    <div>
                      <Label 
                        htmlFor="phone" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Phone Number
                      </Label>
                      <Input 
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="bg-[#111111] border-[#1F1F1F] text-white placeholder:text-[#A1A1A1] focus:border-[#E50914] h-12 rounded-xl"
                        style={{ 
                          height: '48px',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-body)'
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label 
                        htmlFor="role" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Role *
                      </Label>
                      <Select 
                        required
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger 
                          className="bg-[#111111] border-[#1F1F1F] text-white h-12 rounded-xl"
                          style={{ 
                            height: '48px',
                            borderRadius: '12px',
                            fontFamily: 'var(--font-body)'
                          }}
                        >
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0C0C0C] border-[#1F1F1F]">
                          <SelectItem value="ar-manager" className="text-white focus:bg-[#121212] focus:text-white">A&R Manager</SelectItem>
                          <SelectItem value="artist-manager" className="text-white focus:bg-[#121212] focus:text-white">Artist Manager</SelectItem>
                          <SelectItem value="digital-marketer" className="text-white focus:bg-[#121212] focus:text-white">Digital Marketer</SelectItem>
                          <SelectItem value="label-exec" className="text-white focus:bg-[#121212] focus:text-white">Label Executive</SelectItem>
                          <SelectItem value="agency-lead" className="text-white focus:bg-[#121212] focus:text-white">Agency Lead</SelectItem>
                          <SelectItem value="independent-artist" className="text-white focus:bg-[#121212] focus:text-white">Independent Artist</SelectItem>
                          <SelectItem value="other" className="text-white focus:bg-[#121212] focus:text-white">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label 
                        htmlFor="budget" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Monthly Marketing Budget
                      </Label>
                      <Select 
                        value={formData.budget}
                        onValueChange={(value) => setFormData({ ...formData, budget: value })}
                      >
                        <SelectTrigger 
                          className="bg-[#111111] border-[#1F1F1F] text-white h-12 rounded-xl"
                          style={{ 
                            height: '48px',
                            borderRadius: '12px',
                            fontFamily: 'var(--font-body)'
                          }}
                        >
                          <SelectValue placeholder="Select budget range" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0C0C0C] border-[#1F1F1F]">
                          <SelectItem value="<5k" className="text-white focus:bg-[#121212] focus:text-white">&lt; $5k</SelectItem>
                          <SelectItem value="5k-25k" className="text-white focus:bg-[#121212] focus:text-white">$5k – $25k</SelectItem>
                          <SelectItem value="25k-100k" className="text-white focus:bg-[#121212] focus:text-white">$25k – $100k</SelectItem>
                          <SelectItem value="100k+" className="text-white focus:bg-[#121212] focus:text-white">$100k+</SelectItem>
                          <SelectItem value="prefer-not" className="text-white focus:bg-[#121212] focus:text-white">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label 
                        htmlFor="platform" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Primary Platform
                      </Label>
                      <Select 
                        value={formData.platform}
                        onValueChange={(value) => setFormData({ ...formData, platform: value })}
                      >
                        <SelectTrigger 
                          className="bg-[#111111] border-[#1F1F1F] text-white h-12 rounded-xl"
                          style={{ 
                            height: '48px',
                            borderRadius: '12px',
                            fontFamily: 'var(--font-body)'
                          }}
                        >
                          <SelectValue placeholder="Where do you run most campaigns?" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0C0C0C] border-[#1F1F1F]">
                          <SelectItem value="tiktok" className="text-white focus:bg-[#121212] focus:text-white">TikTok</SelectItem>
                          <SelectItem value="instagram" className="text-white focus:bg-[#121212] focus:text-white">Instagram</SelectItem>
                          <SelectItem value="youtube" className="text-white focus:bg-[#121212] focus:text-white">YouTube</SelectItem>
                          <SelectItem value="multi" className="text-white focus:bg-[#121212] focus:text-white">Multi-platform</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label 
                        htmlFor="date" 
                        className="text-white text-sm mb-1.5 block"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Preferred Demo Date
                      </Label>
                      <Input 
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="bg-[#111111] border-[#1F1F1F] text-white focus:border-[#E50914] h-12 rounded-xl"
                        style={{ 
                          height: '48px',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-body)'
                        }}
                      />
                    </div>

                    {/* Privacy Note */}
                    <div className="flex items-center gap-2 pt-2">
                      <ShieldCheck size={18} strokeWidth={1.5} className="text-[#22C55E] flex-shrink-0" />
                      <span 
                        className="text-xs text-[#A1A1A1]"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        We will only use your details to schedule your demo.
                      </span>
                    </div>
                  </>
                )}
              </form>
            </div>

            {/* Sticky Footer with Navigation */}
            <div 
              className="flex-shrink-0 p-6 border-t border-[#1F1F1F] bg-black space-y-3"
              style={{ padding: '20px' }}
            >
              {step === 1 ? (
                <>
                  <Button 
                    type="button"
                    onClick={handleNext}
                    disabled={!formData.name || !formData.email}
                    className="w-full bg-[#E50914] hover:opacity-90 text-white h-12 rounded-xl transition-scale disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      height: '48px',
                      borderRadius: '12px',
                      fontFamily: 'var(--font-body)'
                    }}
                  >
                    Continue
                    <ArrowRight className="ml-2" size={20} strokeWidth={1.5} />
                  </Button>
                  <p 
                    className="text-center text-xs text-[#A1A1A1]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Prefer email?{' '}
                    <a href="mailto:Support@dobbletap.com" className="text-[#E50914] hover:underline">
                      Support@dobbletap.com
                    </a>
                  </p>
                </>
              ) : (
                <div className="flex gap-3">
                  <Button 
                    type="button"
                    onClick={handleBack}
                    className="flex-1 border border-[#1F1F1F] bg-transparent text-white hover:bg-[#121212] h-12 rounded-xl"
                    style={{ 
                      height: '48px',
                      borderRadius: '12px',
                      fontFamily: 'var(--font-body)'
                    }}
                  >
                    <ArrowLeft className="mr-2" size={20} strokeWidth={1.5} />
                    Back
                  </Button>
                  <Button 
                    type="submit"
                    onClick={handleSubmit}
                    disabled={!formData.role}
                    className="flex-1 bg-[#E50914] hover:opacity-90 text-white h-12 rounded-xl transition-scale disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      height: '48px',
                      borderRadius: '12px',
                      fontFamily: 'var(--font-body)'
                    }}
                  >
                    Schedule Demo
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-[#E50914]/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={32} strokeWidth={1.5} className="text-[#E50914]" />
            </div>
            <h2 
              className="text-2xl lg:text-3xl font-bold text-white mb-3"
              style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
            >
              Demo Scheduled!
            </h2>
            <p 
              className="text-sm lg:text-base text-[#A1A1A1] mb-8"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              We'll send you a calendar invite and confirmation email shortly.
            </p>
            <Button 
              onClick={onClose}
              className="border border-[#1F1F1F] bg-transparent text-white hover:bg-[#121212] h-12 px-8 rounded-xl"
              style={{ 
                height: '48px',
                borderRadius: '12px',
                fontFamily: 'var(--font-body)'
              }}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}