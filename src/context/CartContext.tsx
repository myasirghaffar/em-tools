"use client";

import { createContext, useContext } from "react";

export type StoreDrawerTab = "cart" | "favorites";

export interface CartContextType {
  cartItems: any[];
  addToCart: (product: any, quantity?: number) => void;
  updateCartQuantity: (id: number, quantity: number) => void;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  drawerTab: StoreDrawerTab;
  setDrawerTab: (tab: StoreDrawerTab) => void;
  openCart: () => void;
  openFavoritesDrawer: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children, value }: { children: React.ReactNode; value: CartContextType }) => (
  <CartContext.Provider value={value}>{children}</CartContext.Provider>
);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
