import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={
        "w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur px-3 py-2 outline-none " +
        "placeholder:text-white/50 focus:ring-2 focus:ring-white/20 " +
        className
      }
      {...props}
    />
  )
);
Input.displayName = "Input";
export default Input;
