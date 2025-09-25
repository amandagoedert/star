import Logo from "@/assets/images/logo-starlink.svg";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface MenuProps {
  className?: string;
}

export default function Menu({ className }: MenuProps) {
  return (
    <nav className={cn("relative z-50 p-5", className)}>
      <Image
        priority
        width={118}
        className="max-w-[118px] w-full h-auto"
        alt="Logo - Starlink"
        src={Logo}
      />
    </nav>
  );
}
