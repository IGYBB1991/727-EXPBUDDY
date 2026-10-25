"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react";

import { Amount } from "@/components/amount";
import { CategorySelect } from "@/components/category-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OwnerChoice } from "@/lib/db/members";
import { formatDay } from "@/lib/months";
import type { Category } from "@/lib/types";
import { MAX_UPLOAD_BYTES, type ReviewFile, type ReviewTransaction } from "@/lib/upload/types";
import { cn } from "@/lib/utils";
import { saveUploadAction } from "./actions";

const OWNER_KEY = "upload-owner";

// The last "whose statements" choice is remembered in this browser.
function readStoredOwner(): OwnerChoice | null {
  try {
    const saved = localStorage.getItem(OWNER_KEY);
    return saved === "me" || saved === "partner" || saved === "joint" ? saved : null;
  } catch {
    return null; // Storage can be blocked; the default is fine.
  }
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

type Row = ReviewTransaction & { include: boolean; edited: boolean };
type FileState = Omit<ReviewFile, "transactions"> & { accountName: string; rows: Row[] };

type Stage =
  | { name: "pick" }
  | { name: "reading" }
  | { name: "review"; files: FileState[]; notice: string | null }
  | { name: "done"; saved: number };

export function UploadFlow({
  categories,
  accounts,
  myName,
  partnerName,
}: {
  categories: Category[];
  accounts: string[];
  myName: string;
  partnerName: string | null;
}) {
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const storedOwner = useSyncExternalStore(subscribeToStorage, readStoredOwner, () => null);
  const [pickedOwner, setOwner] = useState<OwnerChoice | null>(null);
  const owner = pickedOwner ?? storedOwner ?? "me";
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function chooseOwner(choice: OwnerChoice) {
    setOwner(choice);
    try {
      localStorage.setItem(OWNER_KEY, choice);
    } catch {
      // Ignore: it's only a convenience.
    }
  }

  async function read() {
    setError(null);
    setStage({ name: "reading" });
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.files) {
        throw new Error(body?.error ?? "Something went wrong reading your statements.");
      }
      setStage({
        name: "review",
        notice: body.notice ?? null,
        files: (body.files as ReviewFile[]).map(({ transactions, ...file }) => ({
          ...file,
          accountName: file.bank ?? "",
          rows: transactions.map((t) => ({ ...t, include: t.duplicateOf === null, edited: false })),
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading your statements.");
      setStage({ name: "pick" });
    }
  }

  if (stage.name === "done") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <p className="text-lg font-medium">Saved {stage.saved} transactions</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFiles([]);
                setStage({ name: "pick" });
              }}
            >
              Upload more
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage.name === "review") {
    return (
      <Review
        files={stage.files}
        notice={stage.notice}
        owner={owner}
        categories={categories}
        accounts={accounts}
        onBack={() => setStage({ name: "pick" })}
        onChange={(next) => setStage({ ...stage, files: next })}
        onSaved={(saved) => setStage({ name: "done", saved })}
      />
    );
  }

  const reading = stage.name === "reading";
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const tooBig = totalSize > MAX_UPLOAD_BYTES;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>That didn&apos;t work</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={read} disabled={files.length === 0}>
              <RotateCcw />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Whose statements are these?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {(
              [
                ["me", `Mine (${myName})`],
                ["partner", partnerName ? `${partnerName}'s` : "My partner's"],
                ["joint", "Joint"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={owner === value}
                variant={owner === value ? "default" : "outline"}
                className="h-auto min-h-10 py-2 whitespace-normal"
                disabled={value === "partner" && !partnerName}
                onClick={() => chooseOwner(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          {!partnerName && (
            <p className="mt-2 text-xs text-muted-foreground">
              Your partner&apos;s option appears after they sign in for the first time.
            </p>
          )}
        </CardContent>
      </Card>

      <DropZone files={files} onFiles={setFiles} disabled={reading} />

      {tooBig && (
        <Alert variant="destructive">
          <AlertDescription>
            These files add up to more than 4 MB, which is too big to upload in one go. Remove some and upload them
            separately.
          </AlertDescription>
        </Alert>
      )}

      <Button size="lg" onClick={read} disabled={files.length === 0 || reading || tooBig}>
        {reading ? <Loader2 className="animate-spin" /> : <Upload />}
        {reading
          ? `Reading ${files.length === 1 ? "your statement" : `${files.length} statements`}…`
          : "Read statements"}
      </Button>
      {reading && (
        <p className="text-center text-sm text-muted-foreground">
          This can take up to a minute for PDFs or long statements.
        </p>
      )}
    </div>
  );
}

function DropZone({ files, onFiles, disabled }: { files: File[]; onFiles: (files: File[]) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const accepted = Array.from(list).filter((f) => /\.(csv|pdf)$/i.test(f.name));
    const names = new Set(files.map((f) => f.name));
    onFiles([...files, ...accepted.filter((f) => !names.has(f.name))]);
  }

  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) add(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <Upload className="size-8 text-muted-foreground" />
          <span className="font-medium">Tap to choose files, or drag them here</span>
          <span className="text-sm text-muted-foreground">CSV or PDF, one or more</span>
          <input
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="flex flex-col gap-2">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground">{Math.ceil(f.size / 1024)} KB</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => onFiles(files.filter((x) => x !== f))}
                  aria-label={`Remove ${f.name}`}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Review({
  files,
  notice,
  owner,
  categories,
  accounts,
  onBack,
  onChange,
  onSaved,
}: {
  files: FileState[];
  notice: string | null;
  owner: OwnerChoice;
  categories: Category[];
  accounts: string[];
  onBack: () => void;
  onChange: (files: FileState[]) => void;
  onSaved: (saved: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const included = useMemo(() => files.flatMap((f) => f.rows.filter((r) => r.include)), [files]);
  const toCheck = included.filter((r) => r.needsReview && !r.edited).length;

  function updateFile(key: string, change: (file: FileState) => FileState) {
    onChange(files.map((f) => (f.key === key ? change(f) : f)));
  }

  // Changing one row's category also changes rows from the same merchant
  // that haven't been touched yet.
  function changeCategory(row: Row, categoryId: string | null) {
    const sameMerchant = (r: Row) =>
      r.key === row.key || (!r.edited && row.merchant !== null && r.merchant === row.merchant);
    onChange(
      files.map((f) => ({
        ...f,
        rows: f.rows.map((r) => (sameMerchant(r) ? { ...r, categoryId, edited: true } : r)),
      })),
    );
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await saveUploadAction({
        owner,
        files: files
          .filter((f) => !f.error)
          .map((f) => ({
            fileName: f.fileName,
            bank: f.bank,
            accountName: f.accountName,
            transactions: f.rows
              .filter((r) => r.include)
              .map((r) => ({
                date: r.date,
                description: r.description,
                merchant: r.merchant,
                amount: r.amount,
                direction: r.direction,
                categoryId: r.categoryId,
                confidence: r.confidence,
                needsReview: r.edited ? false : r.needsReview,
                edited: r.edited,
              })),
          })),
      });
      if (result.ok) onSaved(result.data?.saved ?? 0);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Alert>
        <AlertDescription>
          <p>
            Check the categories, untick anything you don&apos;t want, then save. Rows marked{" "}
            <Badge variant="warning">Please check</Badge> are ones we weren&apos;t sure about. Likely duplicates
            start unticked. When you change a category, we&apos;ll remember it for that merchant next time.
          </p>
        </AlertDescription>
      </Alert>

      {notice && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <datalist id="account-names">
        {accounts.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {files.map((file) => (
        <Card key={file.key} className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{file.fileName}</span>
            </CardTitle>
            {!file.error && (
              <CardDescription>
                {file.bank ? `${file.bank} · ` : ""}
                {file.rows.length} transactions
                {file.periodStart && file.periodEnd
                  ? ` · ${formatDay(file.periodStart)} to ${formatDay(file.periodEnd)}`
                  : ""}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {file.error ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>{file.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`account-${file.key}`}>Account or card</Label>
                  <Input
                    id={`account-${file.key}`}
                    list="account-names"
                    placeholder="e.g. DBS Altitude card"
                    value={file.accountName}
                    onChange={(e) => updateFile(file.key, (f) => ({ ...f, accountName: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {file.rows.filter((r) => r.include).length} of {file.rows.length} selected
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFile(file.key, (f) => ({ ...f, rows: f.rows.map((r) => ({ ...r, include: true })) }))}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFile(file.key, (f) => ({ ...f, rows: f.rows.map((r) => ({ ...r, include: false })) }))}
                    >
                      None
                    </Button>
                  </div>
                </div>
                <ul className="-mx-5 divide-y border-y">
                  {file.rows.map((row) => (
                    <ReviewRow
                      key={row.key}
                      row={row}
                      categories={categories}
                      onCategory={(categoryId) => changeCategory(row, categoryId)}
                      onChange={(changes) =>
                        updateFile(file.key, (f) => ({
                          ...f,
                          rows: f.rows.map((r) => (r.key === row.key ? { ...r, ...changes } : r)),
                        }))
                      }
                    />
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} disabled={saving}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {toCheck > 0 && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{toCheck} to check</span>
            )}
            <Button onClick={save} disabled={saving || included.length === 0}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : `Save ${included.length} transaction${included.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  row,
  categories,
  onCategory,
  onChange,
}: {
  row: Row;
  categories: Category[];
  onCategory: (categoryId: string | null) => void;
  onChange: (changes: Partial<Row>) => void;
}) {
  const flagged = row.needsReview && !row.edited;
  return (
    <li className={cn("flex gap-3 px-5 py-3", flagged && row.include && "bg-warning/10", !row.include && "opacity-55")}>
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
        checked={row.include}
        onChange={(e) => onChange({ include: e.target.checked })}
        aria-label={`Include ${row.description}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-medium break-words">{row.merchant ?? row.description}</p>
            <Amount amount={row.amount} direction={row.direction} className="text-sm sm:hidden" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatDay(row.date)}</span>
            {row.merchant && <span className="truncate">· {row.description}</span>}
            {flagged && <Badge variant="warning">Please check</Badge>}
            {row.duplicateOf && <Badge variant="secondary">Likely duplicate</Badge>}
          </div>
          {row.duplicateOf && (
            <p className="mt-1 text-xs text-muted-foreground">
              {row.duplicateOf.alreadySaved ? "Already saved" : "Also in another file"}:{" "}
              {formatDay(row.duplicateOf.date)}, {row.duplicateOf.description}
            </p>
          )}
        </div>
        <Amount amount={row.amount} direction={row.direction} className="hidden w-28 text-right text-sm sm:block" />
        <CategorySelect
          categories={categories}
          value={row.categoryId}
          onChange={onCategory}
          className="w-full sm:w-56"
          aria-label={`Category for ${row.description}`}
        />
      </div>
    </li>
  );
}
