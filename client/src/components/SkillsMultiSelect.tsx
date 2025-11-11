import { useState, useMemo } from "react";
import { Check, ArrowUp, ArrowDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SKILLS_BY_CATEGORY } from "@shared/skills";

interface SkillWithDetails {
  skill: string;
  level: "Basic" | "Intermediate" | "Expert";
  priority: "Must-Have" | "Nice-to-Have";
}

interface SkillsMultiSelectProps {
  value: SkillWithDetails[];
  onChange: (skills: SkillWithDetails[]) => void;
  maxSkills?: number;
  placeholder?: string;
  className?: string;
}

export function SkillsMultiSelect({
  value = [],
  onChange,
  maxSkills = 10,
  placeholder = "Select skills...",
  className,
}: SkillsMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories and skills based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return SKILLS_BY_CATEGORY;

    const query = searchQuery.toLowerCase();
    return SKILLS_BY_CATEGORY.map(category => ({
      ...category,
      skills: category.skills.filter(skill =>
        skill && typeof skill === 'string' && skill.toLowerCase().includes(query)
      ),
    })).filter(category => category.skills.length > 0);
  }, [searchQuery]);

  const selectedSkillNames = useMemo(() => 
    value.filter(s => s && s.skill).map(s => s.skill), 
  [value]);

  const handleToggleSkill = (skillName: string) => {
    const currentIndex = selectedSkillNames.indexOf(skillName);

    if (currentIndex === -1) {
      // Adding a skill - check max limit
      if (value.length >= maxSkills) {
        return; // Don't add if at max
      }
      const newSkill: SkillWithDetails = {
        skill: skillName,
        level: "Intermediate",
        priority: "Must-Have",
      };
      onChange([...value, newSkill]);
    } else {
      // Removing a skill
      onChange(value.filter(s => s && s.skill && s.skill !== skillName));
    }
  };

  const handleRemoveSkill = (skillName: string) => {
    onChange(value.filter(s => s && s.skill && s.skill !== skillName));
  };

  const handleMoveSkill = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= value.length) return;
    
    const newValue = [...value];
    const [movedSkill] = newValue.splice(fromIndex, 1);
    newValue.splice(toIndex, 0, movedSkill);
    
    onChange(newValue);
  };

  const handleUpdateLevel = (index: number, level: "Basic" | "Intermediate" | "Expert") => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], level };
    onChange(newValue);
  };

  const handleUpdatePriority = (index: number, priority: "Must-Have" | "Nice-to-Have") => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], priority };
    onChange(newValue);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left font-normal"
            data-testid="button-skills-select"
          >
            <span className="text-muted-foreground">
              {value.length === 0
                ? placeholder
                : `${value.length} skill${value.length === 1 ? '' : 's'} selected`}
            </span>
            {value.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {value.length}/{maxSkills}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search skills..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              data-testid="input-skills-search"
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No skills found.</CommandEmpty>
              {filteredCategories.map((category) => (
                <CommandGroup
                  key={category.category}
                  heading={category.category}
                >
                  {category.skills.map((skill) => {
                    const isSelected = selectedSkillNames.includes(skill);
                    const isDisabled = !isSelected && value.length >= maxSkills;

                    return (
                      <CommandItem
                        key={skill}
                        value={skill}
                        onSelect={() => handleToggleSkill(skill)}
                        disabled={isDisabled}
                        className={cn(
                          "cursor-pointer",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                        data-testid={`skill-option-${skill.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span>{skill}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Display selected skills with level and priority controls */}
      {value.length > 0 && (
        <div className="space-y-3" data-testid="selected-skills-container">
          {value.filter(skillObj => skillObj && skillObj.skill).map((skillObj, idx) => (
            <div key={skillObj.skill} className="space-y-2 p-3 border rounded-md">
              {/* Skill name and controls row */}
              <div className="flex gap-2 items-center">
                <Badge
                  variant="secondary"
                  className="flex-1"
                  data-testid={`badge-skill-${(skillObj.skill || '').toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {skillObj.skill}
                </Badge>
                <div className="flex gap-1">
                  {/* Move Up Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleMoveSkill(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label="Move skill up"
                    data-testid={`button-move-up-skill-${idx}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  {/* Move Down Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleMoveSkill(idx, idx + 1)}
                    disabled={idx === value.length - 1}
                    aria-label="Move skill down"
                    data-testid={`button-move-down-skill-${idx}`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveSkill(skillObj.skill)}
                    aria-label="Remove skill"
                    data-testid={`button-remove-skill-${(skillObj.skill || '').toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Level and Priority dropdowns row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Skill Level
                  </label>
                  <Select
                    value={skillObj.level}
                    onValueChange={(value) => handleUpdateLevel(idx, value as "Basic" | "Intermediate" | "Expert")}
                  >
                    <SelectTrigger 
                      className="h-8 text-sm"
                      data-testid={`select-skill-level-${idx}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Priority
                  </label>
                  <Select
                    value={skillObj.priority}
                    onValueChange={(value) => handleUpdatePriority(idx, value as "Must-Have" | "Nice-to-Have")}
                  >
                    <SelectTrigger 
                      className="h-8 text-sm"
                      data-testid={`select-skill-priority-${idx}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Must-Have">Must-Have</SelectItem>
                      <SelectItem value="Nice-to-Have">Nice-to-Have</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show max limit warning */}
      {value.length >= maxSkills && (
        <p className="text-xs text-muted-foreground" data-testid="text-max-skills-warning">
          Maximum of {maxSkills} skills reached
        </p>
      )}
    </div>
  );
}
