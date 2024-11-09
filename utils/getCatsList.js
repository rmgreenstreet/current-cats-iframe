import ky from "ky";
import catFormatChecking from "./catFormatChecking.js";
import formatAge from "./formatAge.mjs";

const getCatsList = async(org, catName = "") => {
    try {
        const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${org.public_key}&pagination[limit]=100&search[status]=Available&search[name]=${catName}`, {
            retry: {
                limit: 3,
                methods: ['get'],
                statusCodes: [413, 429, 503],
                backoffLimit: 3000
            }
        }).json();
        // console.log("data before format checking:", data.collection);
        if (data.collection.length) {
            for (let cat of data.collection) {
                cat = catFormatChecking(cat);
                cat.organization_info = org;
                cat.numerical_age = formatAge(cat.date_of_birth);
                cat.display_name = cat.name.slice(org.name_prefix_length, (cat.name.length - org.name_suffix_length)).trim();
            };
        } else {
            console.log("No cats found for Organization", org.name);
            return [];
        }
        // console.log("Found", data.collection.length, "cats for", org.name);
        // console.log("data after format checking:", data);
        return data.collection;
    } catch (err) {
        throw new Error("There was a problem with the Petstablished API");
    }
};

export default getCatsList;