import { useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

export default function CustomerImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [delimiter, setDelimiter] = useState(",");
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [res, setRes] = useState(null);

  const canValidate = useMemo(() => !!file && !validating, [file, validating]);

  const reset = () => {
    setFile(null); setDelimiter(","); setValidating(false); setCommitting(false); setRes(null);
  };

  const handleValidate = async () => {
    if (!file) return;
    try {
      setValidating(true);
      const form = new FormData();
      form.append("file", file);
      form.append("delimiter", delimiter);
      const { data } = await axios.post("/api/customers/import/validate", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRes(data);
      if (data.invalid > 0) toast.error(`Found ${data.invalid} invalid row(s).`);
      else toast.success(`All ${data.valid} row(s) are valid.`);
    } catch (e) {
      const d = e?.response?.data;
      toast.error(d?.message || "Validation failed");
    } finally { setValidating(false); }
  };

  const handleCommit = async (insertValidOnly = true) => {
    if (!res?.token) return;
    try {
      setCommitting(true);
      const { data } = await axios.post("/api/customers/import/commit", {
        token: res.token,
        insert_valid_only: insertValidOnly,
        delimiter,
      });
      toast.success(data?.message || "Import complete");
      onImported?.();
      reset(); onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Import failed");
    } finally { setCommitting(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-[min(900px,95vw)] rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Import Customers (CSV)</h2>
          <button className="px-3 py-1 rounded border hover:bg-gray-50"
                  onClick={() => { reset(); onClose?.(); }}>✕</button>
        </div>

        <div className="p-6 space-y-6">
          {!res && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Choose CSV file <span className="text-gray-500">(header: name[, email, phone, address])</span>
              </label>
              <input type="file" accept=".csv,text/csv"
                     onChange={(e)=>setFile(e.target.files?.[0]||null)}
                     className="block w-full border rounded p-2" />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700">Delimiter</label>
                <select value={delimiter} onChange={(e)=>setDelimiter(e.target.value)}
                        className="border rounded h-9 px-2 text-sm">
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="\t">Tab</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                Need a sample?{" "}
                <a href="/api/customers/import/template" className="text-blue-600 underline">
                  Download CSV template
                </a>
              </div>
              <p className="text-xs text-gray-500">
                Notes: <code>name</code> is required. <code>email</code> must be unique if provided.
              </p>
            </div>
          )}

          {res && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Badge label={`Total: ${res.total}`} />
                <Badge label={`Valid: ${res.valid}`} variant="green" />
                <Badge label={`Invalid: ${res.invalid}`} variant={res.invalid ? "red" : "green"} />
              </div>

              {res.invalid_samples?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Invalid sample rows (first {res.invalid_samples.length}):</h3>
                  <div className="max-h-64 overflow-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr><Th>Row#</Th><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Address</Th><Th>Errors</Th></tr>
                      </thead>
                      <tbody>
                        {res.invalid_samples.map((r,i)=>(
                          <tr key={i} className="odd:bg-white even:bg-gray-50">
                            <Td>{r.row}</Td>
                            <Td>{r.data?.name}</Td>
                            <Td className="break-all">{r.data?.email}</Td>
                            <Td>{r.data?.phone}</Td>
                            <Td>{r.data?.address}</Td>
                            <Td>
                              <ul className="list-disc ml-6">
                                {Object.values(r.errors||{}).map((e,j)=><li key={j}>{e}</li>)}
                              </ul>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {res.valid_samples?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Valid sample rows (first {res.valid_samples.length}):</h3>
                  <div className="max-h-48 overflow-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr><Th>Row#</Th><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Address</Th></tr>
                      </thead>
                      <tbody>
                        {res.valid_samples.map((r,i)=>(
                          <tr key={i} className="odd:bg-white even:bg-gray-50">
                            <Td>{r.row}</Td>
                            <Td>{r.data?.name}</Td>
                            <Td className="break-all">{r.data?.email}</Td>
                            <Td>{r.data?.phone}</Td>
                            <Td>{r.data?.address}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between">
          {!res ? (
            <>
              <div className="text-sm text-gray-600">CSV header: <code>name[,email,phone,address]</code></div>
              <div className="flex items-center gap-2">
                <button className="px-4 h-10 rounded border" onClick={()=>{reset(); onClose?.();}}>Cancel</button>
                <button disabled={!canValidate} onClick={handleValidate}
                        className={`px-4 h-10 rounded text-white ${validating?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>
                  {validating ? 'Validating…' : 'Validate'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="px-4 h-10 rounded border" onClick={reset}>Start Over</button>
              <div className="flex items-center gap-2">
                <button disabled={committing} onClick={()=>handleCommit(true)}
                        className={`px-4 h-10 rounded text-white ${committing?'bg-green-400':'bg-green-600 hover:bg-green-700'}`}
                        title="Insert/Update only valid rows">
                  {committing ? 'Importing…' : `Import ${res.invalid ? 'Valid Rows Only' : 'All'}`}
                </button>
                {res.invalid > 0 && (
                  <button disabled={committing} onClick={()=>handleCommit(false)}
                          className="px-4 h-10 rounded border border-red-600 text-red-700 hover:bg-red-50"
                          title="Abort on first error">
                    Import (Abort on Error)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ label, variant="gray" }) {
  const map = {
    gray:"bg-gray-100 text-gray-700",
    green:"bg-green-100 text-green-700",
    red:"bg-red-100 text-red-700",
  };
  return <span className={`inline-flex items-center px-2 py-1 rounded text-sm ${map[variant]}`}>{label}</span>;
}
function Th({children}){ return <th className="border p-2 text-left">{children}</th> }
function Td({children}){ return <td className="border p-2 align-top">{children}</td> }
