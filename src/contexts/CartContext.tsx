import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { CreatorWithStats } from '../lib/types/database';

// 1. Define the shape of a single item (The Row)
// Updated to use CreatorWithStats for the request flow
interface Product {
  id: string;
  name: string;
  handle?: string;
  platform?: string;
  follower_count?: number;
  image?: string;
}

// Since users can't add multiples, we don't need a 'quantity' field anymore
// but we'll keep the type for consistency if you prefer.
interface CartContextType {
  cart: Product[];
  toggleRow: (product: Product) => void;
  toggleAll: (creators: Product[] | CreatorWithStats[]) => void;
  clearCart: () => void;
  totalItems: number;
  isInCart: (id: string) => boolean;
  // Helper to add creator from CreatorWithStats
  addCreator: (creator: CreatorWithStats) => void;
  removeCreator: (creatorId: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<Product[]>([]);

  // UPDATED: Toggle Logic
  // Updated toggle logic in CartProvider
const toggleRow = (product: Product) => {
    setCart((currentItems) => {
        const exists = currentItems.some((item) => item.id === product.id);
        if (exists) {
        return currentItems.filter((item) => item.id !== product.id);
        }
        return [...currentItems, product];
    });
    };

    // New: Toggle All Logic
const toggleAll = (creators: Product[] | CreatorWithStats[]) => {
  setCart((currentItems) => {
    // Check if all creators on the current page are already in the cart
    const allSelected = creators.every((creator) =>
      currentItems.some((item) => String(item.id) === String(creator.id))
    );

    if (allSelected) {
      // If all are selected, remove only the creators on the current page
      const pageIds = creators.map((c) => String(c.id));
      return currentItems.filter((item) => !pageIds.includes(String(item.id)));
    } else {
      // Otherwise, add the ones that aren't already in the cart
      const newItems = creators
        .filter((creator) => !currentItems.some((item) => String(item.id) === String(creator.id)))
        .map((creator) => ({
          id: creator.id,
          name: creator.name,
          handle: 'handle' in creator ? creator.handle : undefined,
          platform: 'platform' in creator ? creator.platform : undefined,
          follower_count: 'follower_count' in creator ? creator.follower_count : undefined,
        }));
      return [...currentItems, ...newItems];
    }
  });
};

const clearCart = () => setCart([]);

// Helper to check if a creator is in the cart
// Use functional form to ensure we always get the latest cart state
const isInCart = (id: string) => {
  return cart.some((item) => String(item.id) === String(id));
};

// Helper to add a creator from CreatorWithStats
const addCreator = (creator: CreatorWithStats) => {
  setCart((currentItems) => {
    if (currentItems.some((item) => String(item.id) === String(creator.id))) {
      return currentItems; // Already in cart
    }
    return [
      ...currentItems,
      {
        id: creator.id,
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
        follower_count: creator.follower_count,
      },
    ];
  });
};

// Helper to remove a creator
const removeCreator = (creatorId: string) => {
  setCart((currentItems) => currentItems.filter((item) => String(item.id) !== String(creatorId)));
};

  // Derived State (Simplified since quantity is always 1 per row)
  const totalItems = cart.length;
//   const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider
      value={{ 
        cart, 
        toggleRow, // Replaced addToCart/removeFromCart with toggle
        clearCart, 
        totalItems, 
        toggleAll,
        isInCart,
        addCreator,
        removeCreator,
        // totalPrice 
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};