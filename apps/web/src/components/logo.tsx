import darkLogo from "@/assets/logos/dark.svg";
import logo from "@/assets/logos/main.svg";
import Image from "next/image";
import { getAppName, getLogoConfig } from "@/config";

export function Logo() {
  const logoConfig = getLogoConfig();
  const appName = getAppName();

  return (
    <div className="relative h-8 max-w-[10.847rem]">
      <Image
        src={logoConfig.main}
        fill
        className="dark:hidden"
        alt={`${appName} logo`}
        role="presentation"
        quality={100}
      />

      <Image
        src={logoConfig.dark || logoConfig.main}
        fill
        className="hidden dark:block"
        alt={`${appName} logo`}
        role="presentation"
        quality={100}
      />
    </div>
  );
}
