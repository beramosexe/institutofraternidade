import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listEntities } from "@/lib/entities.functions";

export function EntityMultiSelect({
  value, onChange, placeholder = "Selecionar entidades…",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const fn = useServerFn(listEntities);
  const [open, setOpen] = useState(false);

  const { data: entities = [] } = useQuery({
    queryKey: ["entities-all"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  const byId = new Map(entities.map((e) => [e.id, e]));

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
          <Command>
            <CommandInput placeholder="Buscar entidade…" />
            <CommandList>
              <CommandEmpty>Nenhuma entidade cadastrada.</CommandEmpty>
              <CommandGroup>
                {entities.map((e) => (
                  <CommandItem key={e.id} value={e.name} onSelect={() => toggle(e.id)}>
                    <Check className={`mr-2 h-4 w-4 ${value.includes(e.id) ? "opacity-100" : "opacity-0"}`} />
                    {e.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1.5">
              {byId.get(id)?.name ?? id.slice(0, 8)}
              <button type="button" onClick={() => toggle(id)} className="hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
