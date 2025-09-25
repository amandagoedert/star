import IconX from "@/assets/images/icon-x.svg";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface FooterProps {
  className?: string;
}

export default function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("w-full bg-black px-5 py-10", className)}>
      <div className="text-white text-center flex flex-col gap-4">
        <div className="flex gap-4 items-center justify-center">
          <span>Carreiras</span>
          <span>Operadoras de satélite</span>
        </div>
        <div className="flex gap-4 items-center justify-center">
          <span>Revendedores autorizados</span>
          <span>Privacidade e jurídico</span>
        </div>
        <div className="flex gap-4 items-center justify-center">
          <span>Preferências de privacidade</span>
        </div>
      </div>
      <div className="mt-6 text-center text-white flex justify-center items-center gap-2">
        <span className="text-xs">Starlink © 2025</span>
        <span>
          <Image alt="Icon X" src={IconX} />
        </span>
      </div>
      <div className="text-center text-white text-xs mt-8">
        <p>Starlink é uma divisão da SpaceX - 55.764.201/0001-57 </p>
      </div>
    </footer>
  );
}
