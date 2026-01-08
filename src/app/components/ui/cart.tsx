import * as Dialog from '@radix-ui/react-dialog';
import { useCart } from '../../../contexts/CartContext';
import { Trash, X, ShoppingCart } from 'lucide-react';

export const CartSheet = () => {
  const { cart,  totalItems } = useCart();


  //add total price calculation if needed
//   totalPrice, 
  return (
    <Dialog.Root>
      {/* 1. The Trigger (e.g., in your Navbar) */}
        <Dialog.Trigger asChild>
            <button
            className="w-full flex items-center gap-3 px-3 h-9 rounded-md transition-all text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
>
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
        {/* 2. The Dark Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
        
        {/* 3. The Side Panel Content */}
        <Dialog.Content className="fixed top-0 right-0 h-full w-full max-w-md bg-white p-6 shadow-xl animate-slide-in">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-xl font-bold">Your Cart</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-500 hover:text-black"><X /></button>
            </Dialog.Close>
          </div>

          {/* List of Items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">Your cart is empty.</p>
            ) : (
              <ul className="space-y-4">
                {cart.map((item: any) => (
                  <li key={item.id} className="flex justify-between items-center border-b pb-4">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-500">
                        {/* {item.quantity} x ${item.price.toFixed(2)} */} {item.follower_count} Followers
                      </p>
                    </div>
                    {/* <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      <Trash size={18} />
                    </button> */}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer / Checkout */}
          {cart.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <div className="flex justify-between text-lg font-bold mb-4">
                <span>Total</span>
                {/* <span>${totalPrice.toFixed(2)}</span> */}
              </div>
              <button className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition">
                Checkout
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};