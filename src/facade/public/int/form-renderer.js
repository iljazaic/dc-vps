class FormRenderer {
  constructor(configUrl, containerId) {
    this.configUrl = configUrl;
    this.container = document.getElementById(containerId);
    this.config = null;
    this.formData = {};
    this.tprice = 0;
  }

  async init() {
    try {
      const response = await fetch(this.configUrl);
      this.config = await response.json();
      this.render();
    } catch (error) {
      console.error('Error loading form config:', error);
    }
  }

  render() {
    if (!this.config) return;

    const formConfig = this.config.form;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'form-container';

    const titleEl = document.createElement('h1');
    titleEl.textContent = formConfig.title;
    titleEl.className = 'form-title';
    mainDiv.appendChild(titleEl);

    const tabNav = document.createElement('div');
    tabNav.className = 'tab-nav';

    formConfig.tabs.forEach((tab, index) => {
      const tabBtn = document.createElement('button');
      tabBtn.className = 'tab-btn' + (index === 0 ? ' active' : '');
      tabBtn.textContent = tab.label;
      tabBtn.dataset.tabId = tab.id;
      tabBtn.addEventListener('click', () => this.switchTab(tab.id));
      tabNav.appendChild(tabBtn);
    });

    mainDiv.appendChild(tabNav);

    // Create tab content container
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';

    formConfig.tabs.forEach((tab, index) => {
      const tabPane = document.createElement('div');
      tabPane.className = 'tab-pane' + (index === 0 ? ' active' : '');
      tabPane.id = 'tab-' + tab.id;

      if (tab.sections && tab.sections.length > 0) {
        tab.sections.forEach(section => {
          const sectionEl = this.renderSection(section);
          if (tab.id == "specs" && tab.sections.indexOf(section) == 0) {
            const priceLabel = document.createElement("h2");

            priceLabel.textContent = `Monthly Price: ${this.tprice} kr`
            priceLabel.className = "price-label"
            priceLabel.id = "price";
            sectionEl.appendChild(priceLabel);

          }
          tabPane.appendChild(sectionEl);
        });
      } else {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-tab';
        emptyMsg.textContent = 'This section is empty';
        tabPane.appendChild(emptyMsg);
      }
      tabContent.appendChild(tabPane);
    });

    mainDiv.appendChild(tabContent);



    // Create form actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'form-actions';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Reserve and Pay';
    submitBtn.addEventListener('click', () => this.handleSubmit());
    actionsDiv.appendChild(submitBtn);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => this.handleReset());
    actionsDiv.appendChild(resetBtn);

    mainDiv.appendChild(actionsDiv);

    this.container.appendChild(mainDiv);



    this.tprice += this.config.form.prices.ram[document.querySelector("#ram").value];
    this.tprice += this.config.form.prices.storage[document.querySelector("#storage").value];
    this.tprice += this.config.form.prices.vcpu[document.querySelector("#vcpu").value];
    document.querySelector("#price").innerText = `Monthly Price: ${this.tprice} kr`;
  }

  renderSection(section) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'form-section';

    const titleEl = document.createElement('h2');
    titleEl.className = 'section-title';
    titleEl.textContent = section.title;
    sectionDiv.appendChild(titleEl);

    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'form-fields';

    section.fields.forEach(field => {
      const fieldEl = this.renderField(field);
      fieldsDiv.appendChild(fieldEl);
    });

    sectionDiv.appendChild(fieldsDiv);
    return sectionDiv;
  }


  async verifySubdomainAvailability() {
    const button = document.querySelector("#verifyDomainButton");
    let input = document.querySelector("#subdval");
    if (input != null && input != undefined) {
      const reqDomain = input.value;
      try {
        const response = await fetch(`/domain-available?d=${encodeURIComponent(reqDomain)}`);
        const data = await response.json();
        button.style.backgroundColor = data.available == true ? "green" : "red";
        if(data.available){
          this.formData['subd'] = reqDomain;
        }
        //console.log('Domain available:', data.available);
        //return data.available;
      } catch (error) {
        console.log(error)
        console.log(this.formData)
        //console.error('Error checking domain availability:', error);
        button.style.backgroundColor = "red";
        button.innerText = "ERR";
        return false;
      }
    }
  }

  renderField(field) {
    console.log(this.formData)
    const fieldDiv = document.createElement('div');
    fieldDiv.className = field.type == "checkbox" ? 'form-field flex-row' : 'form-field';

    const label = document.createElement('label');
    label.htmlFor = field.id;
    label.className = 'field-label';
    label.textContent = field.label;

    let input;
    let table;
    switch (field.type) {
      case 'table':
        table = document.createElement('table')
        table.id = field.id;
        table.className = "field-input table";

        for (let i = 0; i < field.rows; i++) {
          let tr = document.createElement('tr')
          table.appendChild(tr);
          for (let j = 0; j < field.cols; j++) {
            let td = document.createElement('td');
            tr.appendChild(td);

            if (i == 0) {
              switch (j) {
                case 0:
                  td.innerText = "VM internal port";
                  td.className += " portspan"
                  break;
                case 1:
                  td.innerText = "Subdomain (genereated)";
                  td.className += " portspan"
                  break;

              }

            } else {

              if (field.id == 'porttable') {
                if (j == 0) {
                  let tip = document.createElement('input');
                  tip.className = "field-input portin"

                  tip.addEventListener('input', (e) => {
                    const list = document.querySelectorAll('.portin')
                    var arr = [...list];
                    this.formData[field.id] = '';
                    arr.forEach(inp => {
                      if (inp.value != '') {
                        this.formData[field.id] += inp.value+'|';
                      }
                    });

                  });
                  td.appendChild(tip);

                } else {
                  //let span = document.createElement('span');
                  td.innerText = j == 1 ? "xxxx.dc-vps.com" : "";
                  td.className += " portspan"
                  //td.appendChild(span);

                }
              }
            }

          }
        }

        this.formData[field.id] = "";
        break;
      default:
        input = document.createElement('input');
        input.id = field.id;
        input.className = 'field-input';
        input.type = field.type;
        break;
      case 'subdomain':
        table = document.createElement('table')
        table.id = field.id;
        table.className = "field-input table";
        let tr = document.createElement('tr')
        table.appendChild(tr);
        let td1 = document.createElement('td');
        let inp = document.createElement('input');
        inp.className = 'field-input'
        inp.type = "text";
        inp.id = "subdval";
        td1.appendChild(inp);
        let td2 = document.createElement('td');
        td2.innerText = ".dc-vps.com";
        td2.style.textAlign = "left";
        inp.style.left = "30%";
        tr.appendChild(td1)
        tr.appendChild(td2);
        let td3 = document.createElement('td');
        td3.innerText = "Check availability:  "
        let ver = document.createElement('button');
        ver.className = "verifysubdomain";
        ver.innerText = "?"

        inp.addEventListener('input', (e)=>{
            this.formData[field.id] = '';
            ver.style.backgroundColor = 'white';
        })

        ver.onclick = () => this.verifySubdomainAvailability();
        ver.id = "verifyDomainButton"
        td3.appendChild(ver);
        tr.appendChild(td3);

        this.formData[field.id] = "";
        break;
      case 'file':
        input = document.createElement('input');
        input.id = field.id;
        input.className = 'field-input file';
        input.type = 'file';
        input.setAttribute("accept", field.accept)
        if (field.enabled != true) input.setAttribute("disabled", "");
        break;
      case 'select':
        input = document.createElement('select');
        input.id = field.id;
        input.className = 'field-input';
        if (field.enabled != undefined && field.enabled == false) input.setAttribute('disabled', '');

        field.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          option.selected = opt.value === (field.default || '');
          input.appendChild(option);
        });
        this.formData[field.id] = field.default || field.options[0].value;
        break;

      case 'slider':
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';

        input = document.createElement('input');
        input.type = 'range';
        input.id = field.id;
        input.className = 'field-input slider';
        input.min = field.min;
        input.max = field.max;
        input.step = field.step;
        input.value = field.default || field.min;


        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'slider-value';
        valueDisplay.textContent = this.config.form.values[field.id][field.default] + field.unit;

        input.addEventListener('input', (e) => {
          console.log(this.config.form.values)
          valueDisplay.textContent = this.config.form.values[field.id][e.target.value] + field.unit
          this.formData[field.id] = parseInt(e.target.value);

          let p = this.config.form.prices.ram[document.querySelector("#ram").value];
          p += this.config.form.prices.storage[document.querySelector("#storage").value];
          p += this.config.form.prices.vcpu[document.querySelector("#vcpu").value];
          this.tprice = p;
          document.querySelector('#price').innerText = `Monthly Price: ${p} kr`
        });

        this.formData[field.id] = field.default || field.min;

        sliderContainer.appendChild(input);
        sliderContainer.appendChild(valueDisplay);
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(sliderContainer);
        return fieldDiv;

      case 'checkbox':
        input = document.createElement('input');
        input.type = 'checkbox';
        input.id = field.id;
        input.className = 'field-input';
        input.checked = field.default || false;
        this.formData[field.id] = field.default || false;

        input.addEventListener('change', (e) => {
          this.formData[field.id] = e.target.checked;

          if (field.enable_option != undefined) {
            if (e.target.checked == true) {
              document.querySelector('#' + field.enable_option).removeAttribute("disabled");
            } else {
              document.querySelector('#' + field.enable_option).setAttribute("disabled", '')
            }
          }
        });

        fieldDiv.appendChild(input);
        fieldDiv.appendChild(label);
        return fieldDiv;

      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.id = field.id;
        input.className = 'field-input';
        input.min = field.min;
        input.max = field.max;
        input.value = field.default || field.min;
        this.formData[field.id] = field.default || field.min;

        input.addEventListener('change', (e) => {
          this.formData[field.id] = parseInt(e.target.value);
        });
        break;
    }

    if (field.type !== 'slider') {
      fieldDiv.appendChild(label);
      if (input != undefined) fieldDiv.appendChild(input);
      if (table != undefined) fieldDiv.appendChild(table);
    }

    return fieldDiv;
  }

  switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById('tab-' + tabId).classList.add('active');

    // Add active class to clicked button
    document.querySelector(`[data-tab-id="${tabId}"]`).classList.add('active');
  }

  handleSubmit() {
    console.log('Form submitted with data:', this.formData);
    alert('Configuration submitted:\n' + JSON.stringify(this.formData, null, 2));
  }

  handleReset() {
    // Reset all inputs
    document.querySelectorAll('.field-input').forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else if (input.type === 'range') {
        input.value = input.default;
        input.nextElementSibling.textContent = input.value;
      } else {
        input.value = input.options ? input.options[0].value : '';
      }
    });
    this.formData = {};
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const renderer = new FormRenderer('./conf/form-config.json', 'form-container');
  renderer.init();
});
