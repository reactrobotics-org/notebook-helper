import Link from "next/link";
import { LucideIcon } from "lucide-react";

type DashboardCardProps = {
  title: string;
  value: number | string;
  icon: LucideIcon;
  href: string;
};

export default function DashboardCard({
  title,
  value,
  icon: Icon,
  href,
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="
        group
        overflow-hidden
        rounded-2xl
        bg-white
        shadow
        transition-all
        duration-200
        hover:-translate-y-1
        hover:shadow-xl
      "
    >
      <div className="h-2 bg-[#8ED4FF]" />

      <div className="flex items-center justify-between p-6">

        <div>

          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-5xl font-bold text-[#1C1F23]">
            {value}
          </p>

        </div>

        <div
          className="
            rounded-full
            bg-[#EEF8FF]
            p-4
            text-[#1C1F23]
            transition
            group-hover:bg-[#8ED4FF]
          "
        >
          <Icon size={36} />
        </div>

      </div>
    </Link>
  );
}