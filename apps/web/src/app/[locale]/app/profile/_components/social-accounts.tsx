import Link from "next/link";
import {
  DribbleIcon,
  FacebookIcon,
  GitHubIcon,
  LinkedInIcon,
  XIcon,
} from "./icons";
import { getSocialLinks, getCompanyName } from "@/config";

// Mapeamento de ícones locais para as redes sociais
const ICON_MAP = {
  "GitHub": GitHubIcon,
  "LinkedIn": LinkedInIcon,
  "Twitter": XIcon,
  "X": XIcon,
  "Facebook": FacebookIcon,
  "Dribble": DribbleIcon,
} as const;

const socialLinks = getSocialLinks();
const companyName = getCompanyName();

const ACCOUNTS = socialLinks
  .filter(link => ICON_MAP[link.name as keyof typeof ICON_MAP])
  .map(link => ({
    platform: link.name,
    url: link.url,
    username: link.username,
    Icon: ICON_MAP[link.name as keyof typeof ICON_MAP],
    color: link.color
  }));

export function SocialAccounts() {
  return (
    <div className="mt-4.5">
      <h4 className="mb-3.5 font-medium text-dark dark:text-white">
        Follow {companyName} on
      </h4>
      <div className="flex items-center justify-center gap-3.5">
        {ACCOUNTS.map(({ Icon, platform, url, username, color }) => (
          <Link
            key={platform}
            href={url}
            className="hover:text-primary transition-colors"
            style={{ '--hover-color': color } as React.CSSProperties}
            title={username ? `${platform}: ${username}` : platform}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="sr-only">
              View {companyName} {platform} Account {username && `(${username})`}
            </span>

            <Icon />
          </Link>
        ))}
      </div>
    </div>
  );
}
