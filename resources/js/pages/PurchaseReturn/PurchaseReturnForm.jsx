import usePurchaseReturnForm from "./usePurchaseReturnForm";
import PurchaseReturnFormUI from "./PurchaseReturnFormUI";
import { useNavigate } from "react-router-dom";

export default function PurchaseReturnForm({ returnId, initialData, onSuccess }) {
  const {
    form,
    suppliers,
    products,
    purchaseInvoices,
    batches,
    currentField,
    currentRowIndex,
    supplierSelectRef,
    purchaseInvoiceRef,
    productSearchRefs,
    packQuantityRefs,
    packPurchasePriceRefs,
    itemDiscountRefs,
    handleChange,
    handleSelectChange,
    handleItemChange,
    handleProductSelect,
    handleBatchSelect,
    handleProductKeyDown,
    handleKeyDown,
    addItem,
    removeItem,
    handleSubmit,
  } = usePurchaseReturnForm({ returnId, initialData, onSuccess });

  // Navigate to the Purchase Return index page
  const navigate = useNavigate();
  const INDEX_ROUTE = "/purchase-returns"; // <-- path to your index.jsx (adjust if different)
  const handleCancel = () => {
    navigate(INDEX_ROUTE);
  };

  return (
    <PurchaseReturnFormUI
      returnId={returnId}
      form={form}
      suppliers={suppliers}
      products={products}
      purchaseInvoices={purchaseInvoices}
      batches={batches}
      currentField={currentField}
      currentRowIndex={currentRowIndex}
      supplierSelectRef={supplierSelectRef}
      purchaseInvoiceRef={purchaseInvoiceRef}
      productSearchRefs={productSearchRefs}
      packQuantityRefs={packQuantityRefs}
      packPurchasePriceRefs={packPurchasePriceRefs}
      itemDiscountRefs={itemDiscountRefs}
      handleChange={handleChange}
      handleSelectChange={handleSelectChange}
      handleItemChange={handleItemChange}
      handleProductSelect={handleProductSelect}
      handleBatchSelect={handleBatchSelect}
      handleProductKeyDown={handleProductKeyDown}
      handleKeyDown={handleKeyDown}
      addItem={addItem}
      removeItem={removeItem}
      handleSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
}
