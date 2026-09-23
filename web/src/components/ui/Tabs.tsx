"use client";

import * as T from "@radix-ui/react-tabs";
import * as A from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Tabs = T.Root;
export function TabsList({ className, ...p }: ComponentPropsWithoutRef<typeof T.List>) {
  return <T.List className={cn("-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0", className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn("press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap text-brown transition-colors duration-150 data-[state=active]:bg-cocoa data-[state=active]:text-cream [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8 data-[state=active]:hover:bg-cocoa", className)}
      {...p}
    />
  );
}
export const TabsContent = T.Content;

export const Accordion = A.Root;
export function AccordionItem({ value, title, children, className }: { value: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <A.Item value={value} className={cn("border-b border-line", className)}>
      <A.Header>
        <A.Trigger className="group flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left text-[1.0625rem] font-semibold">
          {title}
          <ChevronDown className="size-5 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
        </A.Trigger>
      </A.Header>
      <A.Content className="overflow-hidden text-brown data-[state=closed]:animate-[fade-out_120ms_ease-out] data-[state=open]:animate-[fade-in_200ms_ease-out]">
        <div className="pb-4 leading-relaxed">{children}</div>
      </A.Content>
    </A.Item>
  );
}
