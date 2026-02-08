import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

interface BillingCancelProps {
  onNavigate: (path: string) => void;
}

export function BillingCancel({ onNavigate }: BillingCancelProps) {
  return (
    <div className="max-w-lg mx-auto mt-12">
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-500/20 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            Payment Canceled
          </h2>
          <p className="text-muted-foreground mb-2">
            Your payment was not completed. No charges were made.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            You can try again anytime or continue with the free plan.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => onNavigate('/subscription')}
              className="h-10 px-6 bg-primary hover:bg-primary/90 text-foreground"
            >
              View Plans
            </Button>
            <Button
              onClick={() => onNavigate('/dashboard')}
              variant="outline"
              className="h-10 px-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-border/60">
            <p className="text-sm text-muted-foreground mb-4">
              Having trouble with payment?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm">
              <a
                href="mailto:support@dobbletap.com"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Contact Support
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <button
                onClick={() => onNavigate('/payment?plan=pro')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Try Different Payment Method
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
