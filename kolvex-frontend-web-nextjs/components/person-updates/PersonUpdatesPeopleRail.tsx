"use client";

import { UsersRound } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarRail } from "@/components/ui/avatar-rail";
import { FED_GROUP, personUpdateRail, type PersonUpdatePerson } from "@/lib/personUpdates";
import { PersonUpdateAvatar } from "./PersonUpdateAvatar";

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
  const items = [
    { name: "", label: allPeople, avatar: null, fedOfficial: false, newCount: 0 },
    ...personUpdateRail(people),
  ].map((person) => ({
    id: person.name,
    label: person.name === FED_GROUP ? c("Fed officials", "美联储官员") : person.label,
    updateLabel: person.newCount
      ? c(
          `${person.newCount} new ${person.newCount === 1 ? "update" : "updates"} since yesterday`,
          `昨日至今 ${person.newCount} 条新动态`,
        )
      : undefined,
    badge: person.newCount,
    avatar: person.name ? (
      <PersonUpdateAvatar
        label={person.label}
        src={person.avatar}
        fedOfficial={person.fedOfficial}
        className="[&>span]:text-lg"
      />
    ) : (
      <Avatar className="h-11 w-11">
        <AvatarFallback>
          <UsersRound className="size-6" />
        </AvatarFallback>
      </Avatar>
    ),
  }));
  return (
    <AvatarRail items={items} label={c("People", "人物")} selected={selected} onSelect={onSelect} />
  );
}
