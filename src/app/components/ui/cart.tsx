"use client";

import * as Dialog from '@radix-ui/react-dialog';
import { useCart } from '../../../contexts/CartContext';
import { Trash, X, ShoppingCart, DollarSign, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export const CartSheet = () => {
  const { cart, totalItems, clearCart } = useCart();
  const [isSending, setIsSending] = useState(false);
  const [campaignDetails, setCampaignDetails] = useState('');
  const [budget, setBudget] = useState('');

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (!campaignDetails.trim()) {
      alert("Please provide campaign details before submitting.");
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please log in to submit an inquiry.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-checkout-email', {
        body: { 
          creators: cart,
          campaignDetails,
          budget: budget || 'Not specified',
          agencyEmail: "idrissolomonsu@yahoo.com",
          userEmail: user.email, 
        },
      });

      if (error) throw error;

      alert("Inquiry sent successfully to the agency!");
      clearCart();
      setCampaignDetails('');
      setBudget('');
    } catch (err) {
      console.error("Checkout Error:", err);
      alert("Failed to send request. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center gap-3 px-3 h-9 rounded-md transition-all text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]">
          <span className="text-slate-500 relative">
            <ShoppingCart size={18} />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-[10px] text-black px-1 rounded-full">
                {totalItems}
              </span>
            )}
          </span>
          <span>Cart</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in z-50" />
        
        <Dialog.Content className="fixed top-0 right-0 h-full w-full sm:max-w-lg bg-[#0D0D0D] border-l border-white/[0.08] shadow-2xl animate-slide-in flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-white">
                  Your Selection
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-400">
                  {totalItems} {totalItems === 1 ? 'creator' : 'creators'} selected
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Creators List */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                  <ShoppingCart className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">Your cart is empty</p>
                <p className="text-slate-500 text-xs mt-1">Add creators to get started</p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Selected Creators</h3>
                <ul className="space-y-2">
                  {cart.map((item: any) => (
                    <li 
                      key={item.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {item.profile_picture_url && (
                          <img 
                            src={item.profile_picture_url} 
                            alt={item.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white text-sm truncate">{item.name}</h4>
                          <p className="text-xs text-slate-400">
                            {(item.follower_count / 1000).toFixed(0)}K followers
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Campaign Details Form */}
            {cart.length > 0 && (
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Campaign Details *
                  </label>
                  <textarea
                    value={campaignDetails}
                    onChange={(e) => setCampaignDetails(e.target.value)}
                    placeholder="Describe your campaign goals, content requirements, timeline, and any specific deliverables..."
                    rows={5}
                    className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Be as detailed as possible to help us match you with the right creators
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Budget (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="text"
                      value={budget}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setBudget(value ? parseInt(value).toLocaleString() : '');
                      }}
                      placeholder="10,000"
                      className="w-full pl-7 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Providing a budget helps us recommend the best creators for your needs
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="border-t border-white/[0.08] p-6 space-y-4 bg-[#0D0D0D]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Creators</span>
                <span className="text-lg font-semibold text-white">{totalItems}</span>
              </div>
              
              <button 
                onClick={handleCheckout} 
                disabled={isSending || !campaignDetails.trim()}
                className="w-full bg-primary text-black py-3 rounded-lg font-medium hover:bg-primary/90 transition-all disabled:bg-white/[0.06] disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  "Submit Inquiry"
                )}
              </button>
              
              <p className="text-xs text-center text-slate-500">
                We'll review your request and get back to you within 24 hours
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};