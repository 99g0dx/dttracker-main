"use client";

import * as Dialog from '@radix-ui/react-dialog';
import { useCart } from '../../../contexts/CartContext';
import { Trash, X, ShoppingCart } from 'lucide-react';
import React, { useState } from 'react'; // Consistent import
import { supabase } from '../../../lib/supabase';

export const CartSheet = () => {
  const { cart, totalItems, clearCart } = useCart();
  const [isSending, setIsSending] = useState(false);

  // 3. The logic for the Edge Function call
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSending(true);
    try {
      // Fetch the current user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please log in to submit an inquiry.");
        return;
      }
      // Invoke the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-checkout-email', {
        body: { 
          creators: cart,
          agencyEmail: "idrissolomonsu@yahoo.com",
          userEmail: user.email, 
        },
      });

      if (error) throw error;

      alert("Inquiry sent successfully to the agency!");
      clearCart(); // Optional: clear cart after success
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
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
        
        <Dialog.Content className="fixed top-0 right-0 h-full w-full max-w-md bg-white p-6 shadow-xl animate-slide-in flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-xl font-bold">Your Cart</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-500 hover:text-black"><X /></button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">Your cart is empty.</p>
            ) : (
              <ul className="space-y-4">
                {cart.map((item: any) => (
                  <li key={item.id} className="flex justify-between items-center border-b pb-4 text-black">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-500">
                         {item.follower_count || 0} Followers
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <div className="flex justify-between text-lg font-bold mb-4 text-black">
                <span>Total Items</span>
                <span>{totalItems}</span>
              </div>
              <button 
                onClick={handleCheckout} 
                disabled={isSending}
                className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400"
              >
                {isSending ? "Sending Request..." : "Checkout"}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};