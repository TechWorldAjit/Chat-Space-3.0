import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import assets from "../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const { authUser, updateProfile, axios } = useContext(AuthContext);

  const [selectedImg, setSelectedImg] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (authUser) {
      setName(authUser.fullName || "");
      setBio(authUser.bio || "");
    }
  }, [authUser]);

  useEffect(() => {
    if (selectedImg) {
      const objectUrl = URL.createObjectURL(selectedImg);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl("");
    }
  }, [selectedImg]);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          let width = img.width;
          let height = img.height;
          let sx = 0;
          let sy = 0;
          let sWidth = width;
          let sHeight = height;
          if (width > height) {
            sx = (width - height) / 2;
            sWidth = height;
          } else {
            sy = (height - width) / 2;
            sHeight = width;
          }
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const webpFile = new File([blob], "profile.webp", { type: "image/webp" });
                webpFile.dataUrl = dataUrl;
                resolve(webpFile);
              } else {
                resolve(file);
              }
            },
            "image/webp",
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image file size must be less than 15MB");
      return;
    }

    const compressed = await compressImage(file);
    setSelectedImg(compressed);
    if (compressed.dataUrl) {
      setPreviewUrl(compressed.dataUrl);
    }
  };

  const uploadDirectToCloudinary = async (file) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const { data: signData } = await axios.get("/api/auth/cloudinary-sign", {
        signal: controller.signal,
      });
      if (!signData || !signData.success) {
        throw new Error(signData?.message || "Failed to get upload signature");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", signData.timestamp);
      formData.append("signature", signData.signature);
      formData.append("folder", signData.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      if (!uploadRes.ok) {
        throw new Error("Direct upload failed");
      }
      const result = await uploadRes.json();
      if (result.secure_url) {
        return result.secure_url;
      }
      throw new Error(result.error?.message || "Cloudinary direct upload failed");
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const readFileAsDataUrl = (file) => {
    if (file?.dataUrl) return Promise.resolve(file.dataUrl);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (!selectedImg) {
        const success = await updateProfile({ fullName: name, bio });
        if (success) navigate("/");
        return;
      }

      let profilePicUrl = selectedImg.dataUrl || "";
      if (!profilePicUrl) {
        try {
          profilePicUrl = await readFileAsDataUrl(selectedImg);
        } catch {
          profilePicUrl = "";
        }
      }

      try {
        const directUrl = await uploadDirectToCloudinary(selectedImg);
        if (directUrl) {
          profilePicUrl = directUrl;
        }
      } catch {
        console.warn("Direct upload fallback to resilient backend update");
      }

      const success = await updateProfile({
        profilePic: profilePicUrl,
        fullName: name,
        bio,
      });

      if (success) {
        navigate("/");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-no-repeat flex items-center justify-center">
      <div className="w-5/6 max-w-2xl backdrop-blur-2xl text-gray-300 border-2 border-gray-600 flex items-center justify-between max-sm:flex-col-reverse rounded-lg">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 p-10 flex-1"
        >
          <h3 className="text-lg">Profile details</h3>
          <label
            htmlFor="avatar"
            className="flex items-center gap-3 cursor-pointer"
          >
            <input
              onChange={handleImageChange}
              type="file"
              id="avatar"
              accept=".png, .jpg, .jpeg, .webp"
              hidden
            />
            <img
              src={
                previewUrl ||
                authUser?.profilePic ||
                assets.avatar_icon
              }
              alt="profile"
              className="w-12 h-12 rounded-full object-cover"
            />
            upload profile image
          </label>
          <input
            onChange={(e) => setName(e.target.value)}
            value={name}
            type="text"
            required
            placeholder="Your name"
            className="p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <textarea
            onChange={(e) => setBio(e.target.value)}
            value={bio}
            placeholder="Write profile bio"
            required
            className="p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            rows={4}
          ></textarea>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-gradient-to-r from-purple-400 to-violet-600 text-white p-2 rounded-full text-lg cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </form>
        <img
          className="max-w-44 aspect-square rounded-full mx-10 max-sm:mt-10 object-cover"
          src={
            previewUrl ||
            authUser?.profilePic ||
            assets.logo_icon
          }
          alt="logo"
        />
      </div>
    </div>
  );
};

export default ProfilePage;
