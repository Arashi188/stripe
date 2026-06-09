package com.ecommerce.service;

import com.ecommerce.dto.ProductRequest;
import com.ecommerce.entity.Category;
import com.ecommerce.entity.Product;
import com.ecommerce.repository.CategoryRepository;
import com.ecommerce.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    public ProductService(ProductRepository productRepository, CategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
    }

    public List<Product> getAllProducts(Long categoryId, Double minPrice, Double maxPrice, String search, String sort) {
        List<Product> products = productRepository.searchProducts(categoryId, minPrice, maxPrice, search);

        if (sort != null) {
            switch (sort) {
                case "price_asc" -> products.sort((a, b) -> a.getPrice().compareTo(b.getPrice()));
                case "price_desc" -> products.sort((a, b) -> b.getPrice().compareTo(a.getPrice()));
                case "name_asc" -> products.sort((a, b) -> a.getName().compareTo(b.getName()));
                case "name_desc" -> products.sort((a, b) -> b.getName().compareTo(a.getName()));
                case "newest" -> products.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
                case "rating" -> products.sort((a, b) -> b.getRating().compareTo(a.getRating()));
            }
        }

        return products;
    }

    public Product getProduct(Long id) {
        return productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Product not found"));
    }

    public List<Product> getFeaturedProducts() {
        return productRepository.findByFeaturedTrueAndActiveTrue();
    }

    public Product createProduct(ProductRequest request) {
        Product product = new Product();
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCompareAtPrice(request.getCompareAtPrice());
        product.setImageUrl(request.getImageUrl());
        product.setImageUrl2(request.getImageUrl2());
        product.setImageUrl3(request.getImageUrl3());
        product.setStockQuantity(request.getStockQuantity());
        product.setSku(request.getSku());
        product.setBrand(request.getBrand());
        product.setFeatured(request.isFeatured());

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Category not found"));
            product.setCategory(category);
        }

        return productRepository.save(product);
    }

    public Product updateProduct(Long id, ProductRequest request) {
        Product product = getProduct(id);
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCompareAtPrice(request.getCompareAtPrice());
        product.setImageUrl(request.getImageUrl());
        product.setImageUrl2(request.getImageUrl2());
        product.setImageUrl3(request.getImageUrl3());
        product.setStockQuantity(request.getStockQuantity());
        product.setSku(request.getSku());
        product.setBrand(request.getBrand());
        product.setFeatured(request.isFeatured());

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Category not found"));
            product.setCategory(category);
        }

        return productRepository.save(product);
    }

    public void deleteProduct(Long id) {
        Product product = getProduct(id);
        product.setActive(false);
        productRepository.save(product);
    }

    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    public Category createCategory(String name, String description, String imageUrl) {
        Category category = new Category();
        category.setName(name);
        category.setDescription(description);
        category.setImageUrl(imageUrl);
        return categoryRepository.save(category);
    }
}
