import React, { createContext, useContext, useState, ReactNode } from 'react';

// 1. Define the shape of a single item (The Row)
interface Product {
  id: string;
  name: string;
//   price: number;
  image?: string;
}

// Since users can't add multiples, we don't need a 'quantity' field anymore
// but we'll keep the type for consistency if you prefer.
interface CartContextType {
  cart: Product[];
  toggleRow: (product: Product) => void;
  toggleAll: (creators: Product[]) => void;
  clearCart: () => void;
  totalItems: number;
//   totalPrice: number;
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
const toggleAll = (creators: Product[]) => {
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
      const newItems = creators.filter(
        (creator) => !currentItems.some((item) => String(item.id) === String(creator.id))
      );
      return [...currentItems, ...newItems];
    }
  });
};
const clearCart = () => setCart([]);

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