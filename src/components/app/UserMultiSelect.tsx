import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchUsers, getProfilesByIds } from "@/lib/works.functions";

export type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null };

export function UserMultiSelect({
  value, onChange, placeholder = "Buscar pessoa…",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const search = useServerFn(searchUsers);
  const byIds = useServerFn(getProfilesByIds);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: selected = [] } = useQuery({
    queryKey: ["profiles-by-ids", [...value].sort().join(",")],
    queryFn: () => byIds({ data: { ids: value } }),
    enabled: value.length > 0,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["search-users", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.trim().length >= 1,
    staleTime: 30_000,
  });

  const selectedMap = useMemo(() => new Map(selected.map((p) => [p.id, p])), [selected]);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            <span className="text-muted-foreground">{placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Digite parte do nome…" value={q} onValueChange={setQ} />
            <CommandList>
              {q.trim().length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground">
                  Digite ao menos 1 caractere.
                </div>
              )}
              {q.trim().length > 0 && results.length === 0 && (
                <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup>
                  {results.map((p) => (
                    <CommandItem key={p.id} value={p.id} onSelect={() => toggle(p.id)}>
                      <Check className={`mr-2 h-4 w-4 ${value.includes(p.id) ? "opacity-100" : "opacity-0"}`} />
                      {p.full_name ?? "(sem nome)"}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const p = selectedMap.get(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1.5">
                {p?.full_name ?? id.slice(0, 8)}
                <button type="button" onClick={() => toggle(id)} className="hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
