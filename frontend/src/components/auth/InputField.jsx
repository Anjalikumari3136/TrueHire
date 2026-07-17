import { useState, useRef } from "react";
import { Eye, EyeOff, AlertCircle, Upload } from "lucide-react";
import "./InputField.css";

export default function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
  options,           // for type="select"
  style,             // animation delay etc
  suggestions,       // autocomplete/suggestions list
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const isPassword = type === "password";
  const isFile = type === "file";
  const isSelect = type === "select";

  const suggestionsId = label
    ? `${label.toLowerCase().replace(/\s+/g, "-")}-suggestions`
    : "input-suggestions-list";

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
    onChange && onChange({ target: { value: file } });
  };

  return (
    <div className="input-wrapper" style={style}>
      {label && <label className="input-label">{label}</label>}

      {isSelect ? (
        <div className="input-field-container">
          {Icon && <Icon size={16} className="input-icon-left" />}
          <select
            className={`input-field${Icon ? " has-icon-left" : ""}${error ? " has-error" : ""}`}
            value={value}
            onChange={onChange}
          >
            <option value="" disabled>Select an option</option>
            {options && options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ) : isFile ? (
        <div className="file-upload-wrapper">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="file-upload-input"
            onChange={handleFileChange}
            id="profile-upload"
          />
          <div className="file-upload-display" onClick={() => fileRef.current.click()}>
            <Upload size={18} />
            <span>{fileName || (placeholder || "Choose a profile image…")}</span>
          </div>
          {preview && (
            <div className="file-preview-container">
              <img src={preview} alt="Preview" className="file-preview-img" />
              <span className="file-preview-name">{fileName}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="input-field-container">
          {Icon && <Icon size={16} className="input-icon-left" />}
          <input
            type={isPassword ? (showPassword ? "text" : "password") : type}
            className={`input-field${Icon ? " has-icon-left" : ""}${error ? " has-error" : ""}`}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            list={suggestions ? suggestionsId : undefined}
          />
          {suggestions && (
            <datalist id={suggestionsId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          {isPassword && (
            <button
              type="button"
              className="input-toggle-btn"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      )}

      {error && (
        <span className="input-error">
          <AlertCircle size={13} />
          {error}
        </span>
      )}
    </div>
  );
}
