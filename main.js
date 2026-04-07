const axios = require('axios');
const cheerio = require('cheerio');
const ObjectsToCsv = require('objects-to-csv');

const AxiosConfig = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000 
};

/**
 * Hàm lấy chi tiết sản phẩm
 */
async function getProductDetail(url) {
    try {
        const { data } = await axios.get(url, AxiosConfig);
        const $ = cheerio.load(data);

        return {
            url: url,
            sku: $('.product-sku__value_prices').text().trim(),
            name: $('.product-title').text().trim(),
            price: $('.price__current').text().trim(),
            // Lấy toàn bộ HTML trong mô tả
            description: $('.disclosure__content.rte.cf').html()?.trim() || ''
        };
    } catch (error) {
        console.error(`❌ Lỗi chi tiết [${url}]: ${error.message}`);
        return null;
    }
}

/**
 * Hàm chính chạy Scraper
 */
async function runScraper(baseUrl, startPage, endPage) {
    let allProducts = [];
    const domain = new URL(baseUrl).origin;

    for (let p = startPage; p <= endPage; p++) {
        // Tạo URL có param phân trang
        const pageUrl = `${baseUrl}?page=${p}`;
        console.log(`\n--- 📂 Đang quét trang ${p}: ${pageUrl} ---`);

        try {
            const { data } = await axios.get(pageUrl, AxiosConfig);
            const $ = cheerio.load(data);

            // Dùng Set để tự động lọc bỏ các href trùng nhau trên cùng 1 trang
            const uniqueLinks = new Set();

            $('a.product-link').each((i, el) => {
                let href = $(el).attr('href');
                if (href) {
                    // Xử lý nếu link là đường dẫn tương đối
                    const fullLink = href.startsWith('http') ? href : domain + href;
                    uniqueLinks.add(fullLink);
                }
            });

            const linksArray = Array.from(uniqueLinks);
            console.log(`🔍 Tìm thấy ${linksArray.length} sản phẩm duy nhất.`);

            // Lấy dữ liệu từng sản phẩm
            for (const link of linksArray) {
                const product = await getProductDetail(link);
                if (product) {
                    allProducts.push(product);
                    console.log(`  ✔ Đã xong: ${product.name}`);
                }
                // Nghỉ 500ms để tránh bị server chặn
                await new Promise(r => setTimeout(r, 500));
            }

        } catch (error) {
            console.error(`❌ Lỗi tại trang danh sách ${p}: ${error.message}`);
        }
    }

    // Xuất ra file CSV
    if (allProducts.length > 0) {
        const csv = new ObjectsToCsv(allProducts);
        const fileName = `./data_products_${Date.now()}.csv`;
        await csv.toDisk(fileName, { append: false });
        console.log(`\n✅ THÀNH CÔNG! Đã lưu ${allProducts.length} sản phẩm vào: ${fileName}`);
    } else {
        console.log('\n/!\ Không thu thập được dữ liệu nào.');
    }
}

// --- CẤU HÌNH TẠI ĐÂY ---
const URL_CUA_BAN = 'https://jpeterman.com/collections/all'; // Thay link thật vào đây
const TRANG_BAT_DAU = 1;
const TRANG_KET_THUC = 3;

runScraper(URL_CUA_BAN, TRANG_BAT_DAU, TRANG_KET_THUC);