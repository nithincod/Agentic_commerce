"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

export default function MerchantProductsPage() {
  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    inventory: "",
  });

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/merchant/products",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load products"
        );
      }

      setProducts(
        Array.isArray(
          data?.products
        )
          ? data.products
          : []
      );
    } catch (err) {
      console.error(
        "Load merchant products error:",
        err
      );

      setError(
        err?.message ||
          "Unable to load products"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function updateField(
    field,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response =
        await fetch(
          "/api/merchant/products",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name: form.name,
              description:
                form.description,
              category:
                form.category,
              price:
                Number(form.price),
              inventory:
                Number(
                  form.inventory
                ),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to create product"
        );
      }

      setProducts(
        (previous) => [
          data.product,
          ...previous,
        ]
      );

      setForm({
        name: "",
        description: "",
        category: "",
        price: "",
        inventory: "",
      });

      setShowForm(false);

      setSuccess(
        `${data.product.name} was added to your catalog.`
      );
    } catch (err) {
      console.error(
        "Create merchant product error:",
        err
      );

      setError(
        err?.message ||
          "Unable to create product"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="merchant" />

      <Topbar />

      <main className="ml-[260px] min-h-screen px-8 pb-10 pt-[108px]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <Link
              href="/merchant"
              className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              <ArrowLeft
                size={15}
              />

              Back to dashboard
            </Link>
          </div>

          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Products
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage the products owned by your merchant account.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  loadProducts
                }
                disabled={
                  loading
                }
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(
                    true
                  );

                  setError("");
                  setSuccess("");
                }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <Plus
                  size={16}
                />

                Add Product
              </button>
            </div>
          </div>

          {success && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <div>
                {success}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSuccess("")
                }
              >
                <X
                  size={16}
                />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                {error}
              </div>
            </div>
          )}

          {/* ADD PRODUCT FORM */}
          {showForm && (
            <section className="mb-6 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Add Product
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    The product will automatically belong to your authenticated merchant account.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(
                      false
                    )
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
                >
                  <X
                    size={18}
                  />
                </button>
              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="grid gap-5 md:grid-cols-2"
              >
                <Field
                  label="Product name"
                  value={
                    form.name
                  }
                  onChange={(
                    value
                  ) =>
                    updateField(
                      "name",
                      value
                    )
                  }
                  placeholder="Gaming Keyboard Pro"
                  required
                />

                <Field
                  label="Category"
                  value={
                    form.category
                  }
                  onChange={(
                    value
                  ) =>
                    updateField(
                      "category",
                      value
                    )
                  }
                  placeholder="gaming"
                  required
                />

                <Field
                  label="Price (₹)"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    form.price
                  }
                  onChange={(
                    value
                  ) =>
                    updateField(
                      "price",
                      value
                    )
                  }
                  placeholder="3499"
                  required
                />

                <Field
                  label="Inventory"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    form.inventory
                  }
                  onChange={(
                    value
                  ) =>
                    updateField(
                      "inventory",
                      value
                    )
                  }
                  placeholder="20"
                  required
                />

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Description
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "description",
                        event.target
                          .value
                      )
                    }
                    placeholder="RGB mechanical keyboard with blue switches"
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setShowForm(
                        false
                      )
                    }
                    disabled={
                      submitting
                    }
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      submitting
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />

                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus
                          size={16}
                        />

                        Create Product
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* PRODUCTS */}
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2
                  size={20}
                  className="animate-spin text-violet-600"
                />

                Loading products...
              </div>
            </div>
          ) : products.length ===
            0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Package
                size={32}
                className="mx-auto text-slate-300"
              />

              <h2 className="mt-4 text-lg font-semibold text-slate-800">
                No products yet
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add your first product to your merchant catalog.
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowForm(
                    true
                  )
                }
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <Plus
                  size={16}
                />

                Add Product
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map(
                (product) => (
                  <ProductCard
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
  required = false,
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
      />
    </div>
  );
}

function ProductCard({
  product,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
          <Package
            size={20}
            className="text-violet-600"
          />
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            product.active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {product.active
            ? "Active"
            : "Inactive"}
        </span>
      </div>

      <h3 className="mt-5 text-base font-semibold text-slate-900">
        {product.name}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {product.description ||
          "No description provided."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">
            Price
          </div>

          <div className="mt-1 font-semibold text-slate-900">
            ₹
            {Number(
              product.price
            ).toLocaleString(
              "en-IN"
            )}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">
            Inventory
          </div>

          <div className="mt-1 font-semibold text-slate-900">
            {product.inventory}
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-400">
        {product.category}
      </div>
    </div>
  );
}