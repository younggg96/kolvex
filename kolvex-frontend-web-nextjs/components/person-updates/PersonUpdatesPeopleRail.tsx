"use client";

import { UsersRound } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarRail } from "@/components/ui/avatar-rail";
import type { PersonUpdatePerson } from "@/lib/personUpdates";

export function PersonUpdatesPeopleRail({
  people,
  selected,
  onSelect,
}: {
  people: PersonUpdatePerson[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const c = useCopy();
  const allPeople = c("All people", "全部人物");
  const items = [{ name: "", label: allPeople, avatar: null, newCount: 0 }, ...people].map(
    (person) => ({
      id: person.name,
      label: person.label,
      updateLabel: person.newCount
        ? c(
            `${person.newCount} new ${person.newCount === 1 ? "update" : "updates"} in the past 24 hours`,
            `近 24 小时 ${person.newCount} 条新动态`,
          )
        : undefined,
      avatar: (
        <Avatar className="h-11 w-11">
          {person.avatar && (
            <AvatarImage
              src={person.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-muted text-xl font-semibold text-foreground">
            {person.name ? Array.from(person.label)[0] : <UsersRound className="size-6" />}
          </AvatarFallback>
        </Avatar>
      ),
    }),
  );
  return (
    <AvatarRail items={items} label={c("People", "人物")} selected={selected} onSelect={onSelect} />
  );
}
