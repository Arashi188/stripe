package com.ecommerce.dto;

import jakarta.validation.constraints.NotNull;

public class CartRequest {
    @NotNull
    private Long productId;
    @NotNull
    private Integer quantity;

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
}
