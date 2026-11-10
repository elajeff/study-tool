import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return <Link href={href} className="logo"><span className="logo-mark"><BookOpenCheck size={21} /></span><span>study tool<span className="logo-period">.</span></span></Link>;
}
