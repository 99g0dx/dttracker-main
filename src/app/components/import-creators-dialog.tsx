import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { X, Upload, Download, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useImportCreators, creatorsKeys } from '../../hooks/useCreators';
import * as csvUtils from '../../lib/utils/csv';

interface ImportCreatorsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportCreatorsDialog({ open, onClose }: ImportCreatorsDialogProps) {
  const queryClient = useQueryClient();
  const [importResult, setImportResult] = useState<{
    success_count: number;
    error_count: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const importCreatorsMutation = useImportCreators();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);

    try {
      const result = await importCreatorsMutation.mutateAsync(file);
      
      // Combine parse errors and create errors
      const allErrors = [
        ...result.parseResult.errors,
        ...result.createResult.errors.map((err) => ({
          row: 0, // Create errors don't have row numbers
          message: `${err.handle} (${err.platform}): ${err.message}`,
        })),
      ];

      setImportResult({
        success_count: result.createResult.success_count,
        error_count: result.parseResult.error_count + result.createResult.error_count,
        errors: allErrors,
      });
      
      // Ensure queries are refetched after import completes
      // The mutation's onSuccess already invalidates, but we'll also refetch here to be sure
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
    } catch (error) {
      console.error('Import error:', error);
      // Error is handled by the mutation's onError
    } finally {
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const template = `platform,handle,name,email,phone,niche,location,followers,base_rate
tiktok,@johndoe,John Doe,john@example.com,+2348012345678,Lifestyle,Lagos Nigeria,250000,150000
instagram,janesmith,Jane Smith,jane@example.com,,Fashion,Abuja,180000,
youtube,@techguru,Tech Guru,,,+2348012345679,Tech,Lagos,500000,300000`;
    
    csvUtils.downloadCSV(template, 'creators_template.csv');
  };

  const handleClose = () => {
    setImportResult(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Import Creators</h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!importCreatorsMutation.isPending && !importResult && (
            <>
              <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer mb-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="creators-csv-upload"
                />
                <label htmlFor="creators-csv-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                  <p className="text-sm text-slate-300 mb-1">Upload CSV file</p>
                  <p className="text-xs text-slate-500 mb-3">Required: platform, handle</p>
                  <p className="text-xs text-slate-400">Optional: name, email, phone, niche, location, followers, base_rate</p>
                </label>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="w-full h-9 mb-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV Template
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {importCreatorsMutation.isPending && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-sm text-slate-300">Importing creators...</p>
              <p className="text-xs text-slate-500 mt-1">This may take a moment</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-400 font-medium mb-1">
                  ✓ {importResult.success_count} creator{importResult.success_count !== 1 ? 's' : ''} imported successfully
                </p>
              </div>

              {importResult.error_count > 0 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400 font-medium mb-2">
                    {importResult.error_count} error{importResult.error_count !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-300">
                        {error.row > 0 ? `Row ${error.row}: ` : ''}{error.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



