import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Lock, 
  Unlock, 
  Save, 
  X,
  Search,
  Share2,
  Twitter,
  Globe,
  Image as ImageIcon,
  Hash,
  Link as LinkIcon,
  HelpCircle,
  Loader2
} from "lucide-react";

interface SEOData {
  slug?: string;
  titleTag?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  imageAlt?: string;
  keywords?: string[];
  hashtags?: string[];
  internalLinks?: { label: string; href: string }[];
  faq?: { q: string; a: string }[];
  jsonld?: string;
  version?: number;
  urgent?: boolean;
}

interface CharacterCounterProps {
  value: string;
  max: number;
}

function CharacterCounter({ value, max }: CharacterCounterProps) {
  const length = value?.length || 0;
  const isOver = length > max;
  
  return (
    <span className={`text-xs font-medium ${isOver ? 'text-red-600' : length > max * 0.9 ? 'text-yellow-600' : 'text-green-600'}`}>
      {length}/{max}
    </span>
  );
}

interface SeoAssistantPanelProps {
  jobId: string;
  existingSEO?: SEOData;
  onSave?: (seo: SEOData) => void;
}

export default function SeoAssistantPanel({ jobId, existingSEO, onSave }: SeoAssistantPanelProps) {
  const [seo, setSeo] = useState<SEOData | null>(existingSEO || null);
  const [locked, setLocked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Refresh state when job changes or existing SEO data changes
  useEffect(() => {
    setSeo(existingSEO || null);
    setLocked(false); // Reset lock when switching jobs
  }, [jobId, existingSEO]);

  const handleGenerate = async () => {
    if (locked && seo) {
      toast({
        title: "SEO Locked",
        description: "Unlock SEO to regenerate metadata",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/seo/generate`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to generate SEO metadata");
      }

      const data = await response.json();
      
      if (data.success && data.seo) {
        setSeo(data.seo);
        toast({
          title: "SEO Generated!",
          description: "AI-powered SEO metadata has been created for this job posting.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate SEO metadata",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!seo) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/seo/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ seo }),
      });

      if (!response.ok) {
        throw new Error("Failed to save SEO metadata");
      }

      const data = await response.json();
      
      if (data.success && data.seo) {
        setSeo(data.seo);
        onSave?.(data.seo);
        toast({
          title: "SEO Saved!",
          description: "Your SEO metadata has been saved successfully.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Could not save SEO metadata",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SEOData, value: any) => {
    if (locked) {
      toast({
        title: "SEO Locked",
        description: "Unlock to edit SEO fields",
        variant: "destructive",
      });
      return;
    }
    setSeo(prev => prev ? { ...prev, [field]: value } : { [field]: value });
  };

  const addKeyword = (keyword: string) => {
    if (!keyword.trim() || locked) return;
    updateField('keywords', [...(seo?.keywords || []), keyword.trim()]);
  };

  const removeKeyword = (index: number) => {
    if (locked) return;
    updateField('keywords', seo?.keywords?.filter((_, i) => i !== index) || []);
  };

  const addHashtag = (hashtag: string) => {
    if (!hashtag.trim() || locked) return;
    const formatted = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    updateField('hashtags', [...(seo?.hashtags || []), formatted]);
  };

  const removeHashtag = (index: number) => {
    if (locked) return;
    updateField('hashtags', seo?.hashtags?.filter((_, i) => i !== index) || []);
  };

  return (
    <Card data-testid="card-seo-assistant">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber" />
              AI SEO Assistant
            </CardTitle>
            <CardDescription>
              Generate and customize SEO metadata to improve search visibility
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={locked ? "default" : "outline"}
              size="sm"
              onClick={() => setLocked(!locked)}
              data-testid="button-toggle-lock"
            >
              {locked ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Unlocked
                </>
              )}
            </Button>
            
            <Button
              onClick={handleGenerate}
              disabled={generating || (locked && !!seo)}
              data-testid="button-generate-seo"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {seo ? 'Regenerate' : 'Generate'} SEO
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {seo && (
        <CardContent className="space-y-6">
          {/* SERP Preview */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4" />
              Google Search Preview
            </Label>
            <Card className="bg-muted p-4 space-y-1" data-testid="serp-preview">
              <div className="text-blue-600 hover:underline text-lg font-medium cursor-pointer line-clamp-1">
                {seo.titleTag || "Job Title Here"}
              </div>
              <div className="text-green-700 text-sm">
                sebenzahub.co.za › jobs › {seo.slug || "job-slug"}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {seo.metaDescription || "Meta description will appear here..."}
              </div>
            </Card>
          </div>

          <Separator />

          {/* URL Slug */}
          <div className="space-y-2">
            <Label htmlFor="seo-slug" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                URL Slug
              </span>
              <CharacterCounter value={seo.slug || ""} max={100} />
            </Label>
            <Input
              id="seo-slug"
              value={seo.slug || ""}
              onChange={(e) => updateField('slug', e.target.value)}
              placeholder="job-title-location"
              disabled={locked}
              data-testid="input-seo-slug"
            />
          </div>

          {/* Title Tag */}
          <div className="space-y-2">
            <Label htmlFor="seo-title" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Page Title
              </span>
              <CharacterCounter value={seo.titleTag || ""} max={60} />
            </Label>
            <Input
              id="seo-title"
              value={seo.titleTag || ""}
              onChange={(e) => updateField('titleTag', e.target.value)}
              placeholder="Senior Accountant - Johannesburg | Sebenza Hub"
              disabled={locked}
              data-testid="input-seo-title"
            />
          </div>

          {/* Meta Description */}
          <div className="space-y-2">
            <Label htmlFor="seo-meta-desc" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Meta Description
              </span>
              <CharacterCounter value={seo.metaDescription || ""} max={155} />
            </Label>
            <Textarea
              id="seo-meta-desc"
              value={seo.metaDescription || ""}
              onChange={(e) => updateField('metaDescription', e.target.value)}
              placeholder="Brief description for search engines (155 chars max)"
              disabled={locked}
              rows={3}
              data-testid="textarea-seo-meta-desc"
            />
          </div>

          <Separator />

          {/* Open Graph / Social Media */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Social Media Preview
            </h4>

            <div className="space-y-2">
              <Label htmlFor="seo-og-title" className="flex items-center justify-between">
                <span>OG Title</span>
                <CharacterCounter value={seo.ogTitle || ""} max={70} />
              </Label>
              <Input
                id="seo-og-title"
                value={seo.ogTitle || ""}
                onChange={(e) => updateField('ogTitle', e.target.value)}
                placeholder="Title for Facebook, LinkedIn"
                disabled={locked}
                data-testid="input-seo-og-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-og-desc" className="flex items-center justify-between">
                <span>OG Description</span>
                <CharacterCounter value={seo.ogDescription || ""} max={200} />
              </Label>
              <Textarea
                id="seo-og-desc"
                value={seo.ogDescription || ""}
                onChange={(e) => updateField('ogDescription', e.target.value)}
                placeholder="Description for social media"
                disabled={locked}
                rows={2}
                data-testid="textarea-seo-og-desc"
              />
            </div>
          </div>

          <Separator />

          {/* Twitter Card */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Twitter className="h-4 w-4" />
              Twitter Card
            </h4>

            <div className="space-y-2">
              <Label htmlFor="seo-twitter-title" className="flex items-center justify-between">
                <span>Twitter Title</span>
                <CharacterCounter value={seo.twitterTitle || ""} max={70} />
              </Label>
              <Input
                id="seo-twitter-title"
                value={seo.twitterTitle || ""}
                onChange={(e) => updateField('twitterTitle', e.target.value)}
                placeholder="Title for Twitter"
                disabled={locked}
                data-testid="input-seo-twitter-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-twitter-desc" className="flex items-center justify-between">
                <span>Twitter Description</span>
                <CharacterCounter value={seo.twitterDescription || ""} max={200} />
              </Label>
              <Textarea
                id="seo-twitter-desc"
                value={seo.twitterDescription || ""}
                onChange={(e) => updateField('twitterDescription', e.target.value)}
                placeholder="Description for Twitter"
                disabled={locked}
                rows={2}
                data-testid="textarea-seo-twitter-desc"
              />
            </div>
          </div>

          <Separator />

          {/* Image Alt Text */}
          <div className="space-y-2">
            <Label htmlFor="seo-image-alt" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image Alt Text
              </span>
              <CharacterCounter value={seo.imageAlt || ""} max={110} />
            </Label>
            <Input
              id="seo-image-alt"
              value={seo.imageAlt || ""}
              onChange={(e) => updateField('imageAlt', e.target.value)}
              placeholder="Description for job posting images"
              disabled={locked}
              data-testid="input-seo-image-alt"
            />
          </div>

          <Separator />

          {/* Keywords */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Keywords ({seo.keywords?.length || 0})
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {seo.keywords?.map((keyword, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1" data-testid={`badge-keyword-${idx}`}>
                  {keyword}
                  {!locked && (
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeKeyword(idx)} />
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add keyword"
                disabled={locked}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                data-testid="input-add-keyword"
              />
            </div>
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Hashtags ({seo.hashtags?.length || 0})
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {seo.hashtags?.map((hashtag, idx) => (
                <Badge key={idx} variant="outline" className="gap-1" data-testid={`badge-hashtag-${idx}`}>
                  {hashtag}
                  {!locked && (
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeHashtag(idx)} />
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add hashtag"
                disabled={locked}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addHashtag(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                data-testid="input-add-hashtag"
              />
            </div>
          </div>

          {/* FAQ Preview */}
          {seo.faq && seo.faq.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  FAQ Schema ({seo.faq.length} items)
                </Label>
                <div className="space-y-2 text-sm">
                  {seo.faq.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-md">
                      <p className="font-semibold">{item.q}</p>
                      <p className="text-muted-foreground mt-1">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              {seo.version && <span>Version {seo.version}</span>}
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !seo}
              size="lg"
              data-testid="button-save-seo"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save SEO Metadata
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}

      {!seo && !generating && (
        <CardContent className="text-center py-12">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            No SEO metadata generated yet. Click "Generate SEO" to create AI-powered metadata for this job posting.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
