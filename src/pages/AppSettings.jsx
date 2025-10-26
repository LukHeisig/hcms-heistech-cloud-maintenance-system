import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Palette, CheckCircle, Sun, Moon, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AppSettings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('system');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      setSelectedTheme(user.theme_preference || 'system');
    } catch (error) {
      console.error("Failed to load current user:", error);
      navigate(createPageUrl("Dashboard"));
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const updateThemePreferenceMutation = useMutation({
    mutationFn: (theme) => base44.auth.updateMe({ theme_preference: theme }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Reload page to apply theme changes
      window.location.reload();
    },
    onError: (error) => {
      console.error("Error updating theme preference:", error);
      alert("Chyba při ukládání preference vzhledu: " + error.message);
    },
  });

  const handleSaveTheme = () => {
    updateThemePreferenceMutation.mutate(selectedTheme);
  };

  if (!currentUser) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Nastavení aplikace</h1>
          <p className="text-slate-600 dark:text-slate-400">Spravujte obecná nastavení pro uživatelské rozhraní aplikace.</p>
        </div>

        <Card className="shadow-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Vzhled aplikace
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Label htmlFor="theme" className="mb-4 block text-lg font-medium text-slate-900 dark:text-white">
              Vyberte preferenci vzhledu:
            </Label>
            <RadioGroup
              id="theme"
              value={selectedTheme}
              onValueChange={setSelectedTheme}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-all cursor-pointer ${
                selectedTheme === 'system' 
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}>
                <RadioGroupItem value="system" id="theme-system" className="mb-3" />
                <Label htmlFor="theme-system" className="flex flex-col items-center space-y-3 cursor-pointer w-full">
                  <div className="w-32 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-sm">
                    <Monitor className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-900 dark:text-white">Systémové</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Podle nastavení zařízení</p>
                  </div>
                </Label>
              </div>

              <div className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-all cursor-pointer ${
                selectedTheme === 'light' 
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}>
                <RadioGroupItem value="light" id="theme-light" className="mb-3" />
                <Label htmlFor="theme-light" className="flex flex-col items-center space-y-3 cursor-pointer w-full">
                  <div className="w-32 h-20 bg-white rounded-lg border-2 border-slate-300 flex items-center justify-center shadow-sm">
                    <Sun className="w-8 h-8 text-yellow-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-900 dark:text-white">Světlý</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Světlý režim</p>
                  </div>
                </Label>
              </div>

              <div className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-all cursor-pointer ${
                selectedTheme === 'dark' 
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}>
                <RadioGroupItem value="dark" id="theme-dark" className="mb-3" />
                <Label htmlFor="theme-dark" className="flex flex-col items-center space-y-3 cursor-pointer w-full">
                  <div className="w-32 h-20 bg-slate-900 rounded-lg border-2 border-slate-700 flex items-center justify-center shadow-sm">
                    <Moon className="w-8 h-8 text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-900 dark:text-white">Tmavý</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tmavý režim</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Tip:</strong> Tmavý režim může pomoci snížit únavu očí při práci ve špatně osvětlených prostorách a šetřit baterii na OLED displejích.
              </p>
            </div>

            <div className="mt-8 flex justify-end items-center gap-4">
              {saveSuccess && (
                <span className="flex items-center text-green-600 dark:text-green-400 text-sm animate-fade-in">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Uloženo!
                </span>
              )}
              <Button
                onClick={handleSaveTheme}
                disabled={updateThemePreferenceMutation.isLoading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              >
                {updateThemePreferenceMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ukládám...
                  </>
                ) : (
                  "Uložit nastavení"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}