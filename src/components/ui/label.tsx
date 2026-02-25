import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

const processChildren = (children: React.ReactNode) => {
  const renderString = (str: string) => {
    if (!str.includes("*")) return str;
    const parts = str.split("*");
    const nodes: React.ReactNode[] = [];
    parts.forEach((part, i) => {
      if (part) nodes.push(part);
      if (i !== parts.length - 1) {
        nodes.push(
          <span key={`req-${i}`} className="text-red-600 ml-1" aria-hidden>
            *
          </span>
        );
      }
    });
    return nodes;
  };

  if (typeof children === "string") return renderString(children);
  if (Array.isArray(children)) {
    return children.map((child, i) => (typeof child === "string" ? <React.Fragment key={i}>{renderString(child)}</React.Fragment> : child));
  }
  return children;
};

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, children, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props}>
    {processChildren(children)}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
